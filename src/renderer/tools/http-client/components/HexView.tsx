import React, { useMemo } from 'react';
import { HEX_ROW_LIMIT, toHexRows } from '../lib/formatters/hex';

interface HexViewProps {
  bytes: Uint8Array;
}

export const HexView: React.FC<HexViewProps> = ({ bytes }) => {
  const rows = useMemo(() => toHexRows(bytes), [bytes]);
  const truncated = bytes.length > HEX_ROW_LIMIT * 16;

  return (
    <div className="select-text">
      <pre className="font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-zinc-600">{row.offset}</span>
            <span className="text-zinc-300">{row.hex}</span>
            <span className="text-zinc-500">{row.ascii}</span>
          </div>
        ))}
      </pre>
      {truncated && (
        <div className="text-[10px] text-zinc-600 mt-2">
          Truncated - showing first {(HEX_ROW_LIMIT * 16).toLocaleString()} bytes of{' '}
          {bytes.length.toLocaleString()}.
        </div>
      )}
    </div>
  );
};
