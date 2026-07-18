import type React from 'react';
import { useEffect, useState } from 'react';
import { formatAge } from '../utils/formatAge';

interface AgeProps {
  timestamp: string;
}

export const Age: React.FC<AgeProps> = ({ timestamp }) => {
  const [prevTimestamp, setPrevTimestamp] = useState(timestamp);
  const [ageStr, setAgeStr] = useState(() => formatAge(timestamp));

  if (timestamp !== prevTimestamp) {
    setPrevTimestamp(timestamp);
    setAgeStr(formatAge(timestamp));
  }

  useEffect(() => {
    if (!timestamp) return;

    const updateAge = () => {
      setAgeStr(formatAge(timestamp));
    };

    const created = new Date(timestamp).getTime();
    const diff = Date.now() - created;
    const intervalTime = diff < 60 * 60 * 1000 ? 1000 : 60000;

    const interval = setInterval(updateAge, intervalTime);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <>{ageStr}</>;
};
