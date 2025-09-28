'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface WeightEntry {
  date: string;
  weight: number;
}

export default function WeightChart() {
  const { user } = useAuth();
  const [weightData, setWeightData] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1M');

  const fetchWeightData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('weight_entries')
        .select('date, weight')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setWeightData(data || []);
    } catch (err) {
      console.error('Error fetching weight data:', err);
      setError('Failed to load weight data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Set up real-time subscription
        const channel = supabase
          .channel('weight_entries_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'weight_entries',
              filter: `user_id=eq.${user.id}`
            },
            () => {
              fetchWeightData(); // Refetch when data changes
            }
          )
          .subscribe();

        // Initial data fetch
        await fetchWeightData();

        return () => {
          channel.unsubscribe();
        };
      } catch (err) {
        console.error('Error setting up real-time subscription:', err);
      }
    };

    fetchData();
  }, [user]);

  const filteredData = useMemo(() => {
    if (timeFrame === 'ALL') return weightData;

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeFrame) {
      case '1W':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return weightData.filter(entry => new Date(entry.date) >= cutoffDate);
  }, [weightData, timeFrame]);

  const timeFrameButtons: { label: string; value: TimeFrame }[] = [
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: 'All', value: 'ALL' },
  ];

  if (loading) return <div className="h-64 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (weightData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-500">
        <p>No weight entries yet</p>
        <p className="text-sm mt-2">Log your weight to start tracking your progress</p>
      </div>
    );
  }

  const data = {
    labels: filteredData.map(entry => new Date(entry.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Weight (lbs)',
        data: filteredData.map(entry => entry.weight),
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        pointBackgroundColor: 'rgb(75, 192, 192)',
        pointRadius: 4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Weight Progress'
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Weight: ${context.parsed.y}lbs`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Weight (lbs)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-end mb-4 space-x-2">
        {timeFrameButtons.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTimeFrame(value)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              timeFrame === value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
      <div className="mt-4 text-center text-sm text-gray-500">
        {filteredData.length > 0 && (
          <div className="flex justify-center space-x-8">
            <div>
              <span className="font-medium">Starting Weight:</span>{' '}
              {filteredData[0].weight}lbs
            </div>
            <div>
              <span className="font-medium">Current Weight:</span>{' '}
              {filteredData[filteredData.length - 1].weight}lbs
            </div>
            <div>
              <span className="font-medium">Total Change:</span>{' '}
              {(filteredData[filteredData.length - 1].weight - filteredData[0].weight).toFixed(1)}lbs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
