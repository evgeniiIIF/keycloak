import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import api from './api/api';
import Home from './pages/Home';
import Service from './pages/Service';

const Navigation = () => {
  const logout = async () => {
    try {
      const response = await api.post('/logout');
      window.location.href = response.data.logoutUrl;
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <div className="nav">
      <Link to="/" className="btn">Home</Link>
      <Link to="/service" className="btn">Service</Link>
      <button onClick={logout} className="btn btn-danger">Logout</button>
    </div>
  );
};

const App = () => (
  <Router>
    <Navigation />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/service" element={<Service />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </Router>
);

export default App;
