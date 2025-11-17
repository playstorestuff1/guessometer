interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

class AirtableService {
  private baseId = process.env.AIRTABLE_BASE_ID || 'appyBygBNgMiHtfkm';
  private apiKey = process.env.AIRTABLE_TOKEN || 'patIWPRWZ9wmBIuia';
  private baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
  
  // Determine table name based on environment
  private getTableName(): string {
    // Check if we're running in production based on domain or environment
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.REPLIT_DOMAINS?.includes('guessometer.com') ||
                        process.env.DEPLOYMENT_DOMAIN?.includes('guessometer.com');
    
    return isProduction ? 'Production' : 'Predictions';
  }

  constructor() {
    console.log('Airtable service initialized with:');
    console.log('Base ID:', this.baseId ? 'Set' : 'Not set');
    console.log('API Key:', this.apiKey ? 'Set (' + this.apiKey.substring(0, 8) + '...)' : 'Not set');
    console.log('Table Name:', this.getTableName());
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log('Making Airtable request to:', url);
    console.log('Using token:', this.apiKey ? this.apiKey.substring(0, 12) + '...' : 'None');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log('Airtable response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Airtable error response:', errorText);
      throw new Error(`Airtable API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Predictions operations
  async getPredictions(): Promise<AirtableRecord[]> {
    const tableName = this.getTableName();
    const response: AirtableResponse = await this.makeRequest(`/${tableName}`);
    return response.records;
  }

  // Get only public predictions for community view
  async getPublicPredictions(): Promise<AirtableRecord[]> {
    // Use Airtable filtering to get only public predictions
    const tableName = this.getTableName();
    const filterFormula = "Privacy = 'Public'";
    const encodedFilter = encodeURIComponent(filterFormula);
    const response: AirtableResponse = await this.makeRequest(`/${tableName}?filterByFormula=${encodedFilter}`);
    return response.records;
  }

  async createPrediction(predictionData: any): Promise<AirtableRecord> {
    // Map our app fields to Airtable field names
    const fields: Record<string, any> = {
      'Prediction Text': predictionData.predictionText,
      'Confidence %': predictionData.confidenceLevel,
      'Category': predictionData.category,
      'Privacy': predictionData.isPublic ? 'Public' : 'Private',
      'Prediction Date': predictionData.predictionDate ? new Date(predictionData.predictionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      'Outcome Known?': 'No',  // Text field indicating if outcome is known
      'Predicted Outcome': 'Yes'  // Default prediction - user can manually set this to 'No' if they predict 'No'
    };
    
    console.log('Creating Airtable prediction with fields:', fields);
    
    const tableName = this.getTableName();
    const response = await this.makeRequest(`/${tableName}`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
    return response;
  }

  async updatePrediction(id: string, predictionData: any): Promise<AirtableRecord> {
    // Map our app fields to Airtable field names for updates
    const fields: Record<string, any> = {};
    
    if (predictionData.outcome !== undefined) {
      if (predictionData.outcome === 'correct') {
        fields['Actual Outcome'] = 'Yes';  // What actually happened
        fields['Outcome Known?'] = 'Yes';
      } else if (predictionData.outcome === 'incorrect') {
        fields['Actual Outcome'] = 'No';   // What actually happened
        fields['Outcome Known?'] = 'Yes';
      } else {
        fields['Outcome Known?'] = 'No';   // Still pending
      }
    }
    
    if (predictionData.confidenceLevel !== undefined) {
      fields['Confidence %'] = predictionData.confidenceLevel;
    }
    
    console.log('Updating Airtable prediction with fields:', fields);
    
    const tableName = this.getTableName();
    const response = await this.makeRequest(`/${tableName}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    return response;
  }

  async deletePrediction(id: string): Promise<boolean> {
    try {
      console.log('Deleting Airtable prediction with ID:', id);
      const tableName = this.getTableName();
      await this.makeRequest(`/${tableName}/${id}`, {
        method: 'DELETE',
      });
      console.log('Successfully deleted prediction from Airtable');
      return true;
    } catch (error) {
      console.error('Error deleting prediction from Airtable:', error);
      return false;
    }
  }

  // Helper method to map Airtable outcome to our format
  private mapAirtableOutcome(predictedOutcome: string, outcomeKnown: string): string {
    if (outcomeKnown !== 'Yes') return 'pending';
    if (predictedOutcome === 'Yes') return 'correct';
    if (predictedOutcome === 'No') return 'incorrect';
    return 'pending';
  }

  // Categories operations - using existing prediction categories
  async getCategories(): Promise<string[]> {
    try {
      const predictions = await this.getPredictions();
      const categories = new Set<string>();
      
      predictions.forEach(record => {
        const category = record.fields['Category'];
        if (category && typeof category === 'string') {
          categories.add(category);
        }
      });
      
      return Array.from(categories);
    } catch (error) {
      console.error('Error getting categories from Airtable:', error);
      return ['Finance', 'Technology', 'Personal', 'Sports', 'Politics', 'Weather'];
    }
  }

  // Users operations (for sync)
  async getUsers(): Promise<AirtableRecord[]> {
    const response: AirtableResponse = await this.makeRequest('/Users');
    return response.records;
  }

  async createUser(fields: Record<string, any>): Promise<AirtableRecord> {
    const response = await this.makeRequest('/Users', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
    return response;
  }

  // Sync operations
  async syncPredictionsToLocal(storage: any): Promise<void> {
    try {
      const airtablePredictions = await this.getPredictions();
      
      for (const record of airtablePredictions) {
        const fields = record.fields;
        
        // Map Airtable fields to local schema
        const predictionData = {
          airtableId: record.id,
          userId: fields['User'] ? (Array.isArray(fields['User']) ? fields['User'][0] : fields['User']) : 'unknown',
          predictionText: fields['Prediction Text'] || '',
          description: fields['Prediction Text'] || '', // Use same field as description for now
          category: fields['Category'] || 'general',
          confidenceLevel: fields['Confidence %'] || 50,
          targetDate: new Date(fields['Remind Date'] || Date.now()),
          outcome: this.mapAirtableOutcome(fields['Predicted Outcome'], fields['Outcome Known?']),
          isPublic: fields['Privacy'] !== 'Private',
          predictionDate: new Date(fields['Prediction Date'] || record.createdTime),
        };

        // Create or update local prediction
        await storage.createPrediction(predictionData);
      }
    } catch (error) {
      console.error('Error syncing predictions from Airtable:', error);
    }
  }

  async syncCategoriesToLocal(storage: any): Promise<void> {
    try {
      const categories = await this.getCategories();
      
      for (const categoryName of categories) {
        const categoryData = {
          name: categoryName,
          color: '#666666',
        };

        await storage.createCategory(categoryData);
      }
    } catch (error) {
      console.error('Error syncing categories from Airtable:', error);
    }
  }
}

export const airtableService = new AirtableService();
