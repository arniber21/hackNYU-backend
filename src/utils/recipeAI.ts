import { Recipe } from '../types/api';

export async function generateRecipe(
  user: any,
  fitnessGoals: any,
  ingredients: string[],
  skillLevel: number = 2,
  preferences: any = {},
  maxCookingTime: number = 60
): Promise<Recipe.GeneratedRecipe> {
  try {
    console.log('Starting recipe generation with params:', {
      userId: user.id,
      ingredients,
      skillLevel,
      preferences,
      maxCookingTime,
      fitnessGoals: {
        calories: fitnessGoals.calories,
        protein: fitnessGoals.protein
      }
    });

    const prompt = `Generate a detailed recipe with the following requirements:
      - Using these ingredients: ${ingredients.join(', ')}
      - Cooking skill level: ${skillLevel}/3
      - Max cooking time: ${maxCookingTime} minutes
      - Dietary preferences: ${Object.entries(preferences || {})
        .filter(([_, value]) => value)
        .map(([key]) => key)
        .join(', ')}
      - Fitness goals: ${fitnessGoals.calories} calories, ${fitnessGoals.protein}g protein
      
      Format the response as a JSON object with:
      - name: string (recipe name)
      - ingredients: array of {item: string, quantity: string}
      - instructions: array of detailed step-by-step instructions
      - cookingTime: number (in minutes)
      - difficulty: string (Easy/Medium/Hard)
      - nutritionalInfo: {
          calories: number,
          protein: number,
          carbs: number,
          fat: number
        }
      - image: string (descriptive text for image generation)`;

    console.log('Sending prompt to Mistral API:', prompt);

    const response = await fetch(process.env.MISTRAL_API_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-medium",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Mistral API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw Mistral API response:', data);

    let recipe;
    try {
      recipe = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse Mistral response:', {
        error: parseError,
        content: data.choices[0].message.content
      });
      throw new Error('Failed to parse recipe data from AI response');
    }

    // Validate required fields
    const requiredFields = ['name', 'ingredients', 'instructions', 'cookingTime', 'difficulty', 'nutritionalInfo'];
    const missingFields = requiredFields.filter(field => !recipe[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields in recipe:', {
        missingFields,
        recipe
      });
      throw new Error(`Missing required fields in recipe: ${missingFields.join(', ')}`);
    }

    const formattedRecipe = {
      name: recipe.name,
      ingredients: recipe.ingredients.map((ing: any) => ({
        item: ing.item,
        quantity: ing.quantity
      })),
      instructions: recipe.instructions,
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      nutritionalInfo: {
        calories: recipe.nutritionalInfo.calories,
        protein: recipe.nutritionalInfo.protein,
        carbs: recipe.nutritionalInfo.carbs,
        fat: recipe.nutritionalInfo.fat
      },
      image: recipe.image || "A professionally plated dish of " + recipe.name
    };

    console.log('Successfully generated recipe:', formattedRecipe);
    return formattedRecipe;

  } catch (error) {
    console.error('Recipe generation failed:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      user: user.id,
      ingredients,
      skillLevel,
      preferences,
      maxCookingTime
    });
    
    if (error instanceof Error) {
      throw new Error(`Recipe generation failed: ${error.message}`);
    }
    throw new Error('Recipe generation failed unexpectedly');
  }
} 