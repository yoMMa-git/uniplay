import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'
import App from '../App';
import { MemoryRouter } from 'react-router-dom';

test('renders login form', () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText(/Login/i)).toBeInTheDocument();
});
