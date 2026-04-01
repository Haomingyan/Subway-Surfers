import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StationPage from './pages/StationPage';
import RealtimeData from './Components/RealtimeData/RealtimeData';
import SubwayMap from './Components/SubwayMap/SubwayMap';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RealtimeData />} />
        <Route path="/map" element={<SubwayMap />} />
        <Route path="/station/:stationId" element={<StationPage />} />
      </Routes>
    </Router>
  );
}

export default App;
