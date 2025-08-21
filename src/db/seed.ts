import { db } from './connection.js';
import { addAnime } from './queries.js';

// Sample anime data for development
const sampleAnime = [
  {
    malId: 16498,
    title: 'Attack on Titan',
    titleEnglish: 'Attack on Titan',
    titleJapanese: '進撃の巨人',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
    rating: 9.0,
    numEpisodes: 25,
  },
  {
    malId: 11061,
    title: 'Hunter x Hunter (2011)',
    titleEnglish: 'Hunter x Hunter',
    titleJapanese: 'ハンター×ハンター',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1337/99013.jpg',
    rating: 9.1,
    numEpisodes: 148,
  },
  {
    malId: 9253,
    title: 'Steins;Gate',
    titleEnglish: 'Steins;Gate',
    titleJapanese: 'シュタインズ・ゲート',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/5/73199.jpg',
    rating: 9.0,
    numEpisodes: 24,
  }
];

export async function seedDatabase() {
  try {
    console.log('Seeding database with sample data...');
    
    for (const anime of sampleAnime) {
      try {
        await addAnime(anime);
        console.log(`Added: ${anime.title}`);
      } catch (error) {
        // Skip if already exists
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`Skipped (already exists): ${anime.title}`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('Database seeding completed');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}