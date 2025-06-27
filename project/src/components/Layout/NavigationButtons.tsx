import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';

const NavigationButtons: React.FC = () => {
  const navigate = useNavigate();
  
  const navigationButtons = [
    { name: 'Prescription', path: '/prescription' },
    { name: 'Order Card', path: '/order-card' },
    { name: 'Contact Lens Card', path: '/contact-lens-card' },
    { name: 'Billing', path: '/billing' },
    { name: 'Customer History', path: '/customer-history' },
    { name: 'Database Backup', path: '/database-backup' },
  ];
  
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:space-x-2 md:space-y-0 px-4 py-2 bg-gray-50 border-b border-gray-300 w-full">
      {navigationButtons.map((button) => (
        <Button
          key={button.name}
          variant="nav"
          size="md"
          className="w-full md:w-auto"
          onClick={() => navigate(button.path)}
        >
          {button.name}
        </Button>
      ))}
    </div>
  );
};

export default NavigationButtons;