import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string | number;
  icon: string;
  iconBgClass: string;
  iconTextClass: string;
  sparklineData?: Array<{ value: number }>;
  sparklineColor?: string;
  sparklineType?: 'line' | 'area';
}

const StatCard = ({ 
  title, 
  value, 
  change, 
  icon, 
  iconBgClass, 
  iconTextClass, 
  sparklineData,
  sparklineColor = '#10b981',
  sparklineType = 'line'
}: StatCardProps) => {
  const isPositiveChange = typeof change === 'string' 
    ? change.startsWith('+') 
    : typeof change === 'number' && change > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex justify-between">
        <div className="flex items-center">
          <div className={`p-2 rounded-md ${iconBgClass} ${iconTextClass}`}>
            <i className={`${icon} text-xl`}></i>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
        
        {/* Sparkline Chart (if data provided) */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="w-20 h-14">
            <ResponsiveContainer width="100%" height="100%">
              {sparklineType === 'line' ? (
                <LineChart data={sparklineData}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={sparklineColor} 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id={`sparkline-gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={sparklineColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={sparklineColor} 
                    fillOpacity={1}
                    fill={`url(#sparkline-gradient-${title.replace(/\s+/g, '-')})`}
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
      
      {change && (
        <div className="mt-2 flex items-center text-sm">
          <span className={`flex items-center ${isPositiveChange ? 'text-success-500' : 'text-red-500'}`}>
            <i className={`${isPositiveChange ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} mr-1`}></i> 
            {typeof change === 'number' ? `${change}%` : change}
          </span>
          <span className="text-gray-500 ml-2">vs last month</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
