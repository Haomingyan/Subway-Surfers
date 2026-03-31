import { useParams } from 'react-router-dom';
import AccessibilityInfo from '../Components/AccessibilityInfo';

const StationPage = () => {
    const { stationId } = useParams();

    return (
        <div className="station-page">
            <AccessibilityInfo stationId={stationId} />
        </div>
    );
};

export default StationPage;
