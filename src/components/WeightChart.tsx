'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
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
import { fadeInUp, popIn, bounceScale } from '@/utils/animations';

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
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isCustomDate, setIsCustomDate] = useState(false);

  const fetchWeightData = useCallback(async () => {
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
  }, [user]);

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
  }, [user, fetchWeightData]);

  const filteredData = useMemo(() => {
    if (isCustomDate && startDate && endDate) {
      return weightData.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
      });
    }

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
  }, [weightData, timeFrame, isCustomDate, startDate, endDate]);

  const timeFrameButtons: { label: string; value: TimeFrame }[] = [
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: 'All', value: 'ALL' },
  ];

  if (loading) return (
    <motion.div
      className="h-64 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 360]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }}
        className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent"
      />
    </motion.div>
  );

  if (error) return (
    <motion.div
      className="text-red-500"
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      {error}
    </motion.div>
  );

  if (weightData.length === 0) {
    return (
      <motion.div
        className="h-64 flex flex-col items-center justify-center text-gray-500"
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
      >
        <motion.p variants={popIn}>No weight entries yet</motion.p>
        <motion.p
          className="text-sm mt-2"
          variants={popIn}
          transition={{ delay: 0.2 }}
        >
          Log your weight to start tracking your progress
        </motion.p>
      </motion.div>
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
          label: function(context: { parsed: { y: number } }) {
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

  const weightChange = filteredData.length > 0
    ? filteredData[filteredData.length - 1].weight - filteredData[0].weight
    : 0;

  return (
    <motion.div
      className="bg-white p-6 rounded-lg shadow"
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      <motion.div
        className="flex flex-wrap items-center justify-between mb-4 gap-4"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
      >
        <motion.div 
          className="flex space-x-2"
          variants={{
            hidden: { opacity: 0, x: -20 },
            visible: { opacity: 1, x: 0 }
          }}
        >
          {timeFrameButtons.map(({ label, value }) => (
            <motion.button
              key={value}
              onClick={() => {
                setTimeFrame(value);
                setIsCustomDate(false);
              }}
              className={`px-3 py-1 rounded text-sm font-medium transform transition-colors ${
                timeFrame === value && !isCustomDate
                  ? 'bg-[var(--accent)] text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-[var(--accent-glow)] hover:text-[var(--accent)]'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              variants={popIn}
            >
              {label}
            </motion.button>
          ))}
        </motion.div>

        <motion.div 
          className="flex items-center space-x-4"
          variants={{
            hidden: { opacity: 0, x: 20 },
            visible: { opacity: 1, x: 0 }
          }}
        >
          <motion.div className="flex items-center space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setIsCustomDate(true);
              }}
              className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
            />
            <span className="text-[var(--accent)]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setIsCustomDate(true);
              }}
              className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
            />
          </motion.div>
          {isCustomDate && (
            <motion.button
              onClick={() => {
                setIsCustomDate(false);
                setStartDate('');
                setEndDate('');
                setTimeFrame('1M');
              }}
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-glow)]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              Reset
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="h-64 relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="absolute inset-0"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            visible: { 
              opacity: 1, 
              scale: 1,
              transition: {
                type: "spring",
                stiffness: 100,
                damping: 20
              }
            }
          }}
        >
          <Line data={data} options={options} />
        </motion.div>
        
        {filteredData.length === 0 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            No data available for selected date range
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {filteredData.length > 0 && (
          <motion.div
            className="mt-4 text-center text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <motion.div
              className="flex justify-center space-x-8"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
            >
              <motion.div
                variants={popIn}
                className="p-3 rounded-lg bg-gray-50"
              >
                <span className="font-medium">Starting Weight:</span>{' '}
                <span className="text-indigo-600">{filteredData[0].weight}lbs</span>
              </motion.div>

              <motion.div
                variants={popIn}
                className="p-3 rounded-lg bg-gray-50 flex items-center gap-6"
              >
                <div>
                  <span className="font-medium">Current Weight:</span>{' '}
                  <span className="text-indigo-600">{filteredData[filteredData.length - 1].weight}lbs</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium">Total Change:</span>{' '}
                  <motion.span
                    className={weightChange <= 0 ? "text-green-500 ml-1" : "text-red-500 ml-1"}
                    initial={{ scale: 1 }}
                    whileHover={bounceScale}
                  >
                    {weightChange.toFixed(1)}lbs
                  </motion.span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
