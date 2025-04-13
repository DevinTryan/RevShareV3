interface StatCardProps {
  title: string;
  value: string | number;
  change?: string | number;
  icon: string;
  iconBgClass: string;
  iconTextClass: string;
}

const StatCard = ({ title, value, change, icon, iconBgClass, iconTextClass }: StatCardProps) => {
  const isPositiveChange = typeof change === 'string' 
    ? change.startsWith('+') 
    : typeof change === 'number' && change > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center">
        <div className={`p-2 rounded-md ${iconBgClass} ${iconTextClass}`}>
          <i className={`${icon} text-xl`}></i>
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
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
