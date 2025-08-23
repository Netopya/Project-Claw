import { ErrorBoundary } from './ErrorBoundary';
import { WatchlistApp } from './WatchlistApp';

interface Anime {
  id: number;
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  imageUrl: string | null;
  rating: number | null;
  premiereDate: string | null;
  numEpisodes: number | null;
  seriesInfo: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface AppProps {
  initialAnime?: Anime[];
  apiError?: string | null;
}

export function App({ initialAnime, apiError }: AppProps) {
  return (
    <ErrorBoundary>
      <WatchlistApp initialAnime={initialAnime} apiError={apiError} />
    </ErrorBoundary>
  );
}