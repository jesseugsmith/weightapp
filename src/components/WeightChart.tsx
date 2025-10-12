'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface WeightEntry {
  date: string;
  weight: number;
}

const chartConfig = {
  weight: {
    label: "Weight",
    color: "#00D4FF",
  },
} satisfies ChartConfig

export default function WeightChart() {
  const { user } = useAuth();
  const [weightData, setWeightData] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1M');

  const fetchWeightData = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createBrowserClient();
      const { data: records, error } = await supabase
        .from('weight_entries')
        .select('date, weight')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;

      const weightEntries = (records || []).map(record => ({
        date: record.date,
        weight: record.weight
      }));

      setWeightData(weightEntries);
    } catch (err) {
      console.error('Error fetching weight data:', err);
      setError('Failed to load weight data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createBrowserClient>['channel']> | null = null;

    const fetchData = async () => {
      if (!user) {
        setWeightData([]);
        return;
      }

      try {
        const supabase = createBrowserClient();
        
        // Set up real-time subscription with Supabase
        channel = supabase
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
      } catch (err) {
        console.error('Error setting up real-time subscription:', err);
      }
    };

    fetchData();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [user, fetchWeightData]);

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

  const chartData = useMemo(() => {
    return filteredData.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: entry.weight,
    }));
  }, [filteredData]);

  const timeFrameButtons: { label: string; value: TimeFrame }[] = [
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: 'All', value: 'ALL' },
  ];

  if (loading) return (
    <Card>
      <CardContent className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary rounded-full border-t-transparent animate-spin" />
      </CardContent>
    </Card>
  );

  if (error) return (
    <Card>
      <CardContent className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </CardContent>
    </Card>
  );

  if (weightData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>No weight entries yet</p>
          <p className="text-sm mt-2">Log your weight to start tracking your progress</p>
        </CardContent>
      </Card>
    );
  }

  const weightChange = filteredData.length > 0
    ? filteredData[filteredData.length - 1].weight - filteredData[0].weight
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Weight Progress</CardTitle>
            <CardDescription>Track your weight over time</CardDescription>
          </div>
          
          <div className="flex space-x-2">
            {timeFrameButtons.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setTimeFrame(value)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timeFrame === value
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available for selected date range
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `${value} lbs`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="weight"
                  type="natural"
                  fill="var(--color-weight)"
                  fillOpacity={0.4}
                  stroke="var(--color-weight)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>

            {filteredData.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Starting Weight</span>
                  <p className="text-2xl font-bold text-foreground">{filteredData[0].weight} lbs</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Current Weight</span>
                  <p className="text-2xl font-bold text-foreground">
                    {filteredData[filteredData.length - 1].weight} lbs
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Change</span>
                  <p className={`text-2xl font-bold ${
                    weightChange <= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    {weightChange === 0 
                      ? 'No change' 
                      : weightChange < 0 
                        ? `↓ ${Math.abs(weightChange).toFixed(1)} lbs` 
                        : `↑ ${weightChange.toFixed(1)} lbs`}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
