import React from 'react';
import { FileQuestion } from 'lucide-react';

/**
 * @component EmptyState
 * @description Empty state placeholder with icon and action.
 */
const EmptyState = ({
  icon: Icon = FileQuestion,
  title = 'No data',
  description,
  action,
}) => {
  return (
    <div className="glass-card p-12 text-center space-y-4">
      <div className="w-16 h-16 mx-auto bg-dark-700 rounded-2xl
                      flex items-center justify-center">
        <Icon size={32} className="text-dark-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-dark-300">{title}</h3>
        {description && (
          <p className="text-sm text-dark-500 max-w-md mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;