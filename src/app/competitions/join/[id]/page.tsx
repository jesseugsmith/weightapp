import { Metadata } from 'next';
import JoinCompetitionClient from './JoinCompetitionClient';

export const metadata: Metadata = {
  title: 'Join Competition',
  description: 'Join a weight loss competition',
};

interface JoinCompetitionPageProps {
  params: {
    id: string;
  };
}

export default function JoinCompetitionPage({ params }: JoinCompetitionPageProps) {
  return <JoinCompetitionClient id={params.id} />;
}
