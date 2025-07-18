import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', ...props }) => {
  return (
    <div className={`bg-white rounded shadow-md overflow-hidden ${className}`} {...props}>
      {title && (
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

export default Card;