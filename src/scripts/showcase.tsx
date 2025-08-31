import React from 'react';
import { createRoot } from 'react-dom/client';
import { ComponentShowcase } from '../components/ComponentShowcase';

// Mount the showcase component when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('showcase-root');
  if (container) {
    const root = createRoot(container);
    root.render(<ComponentShowcase />);
  }
});