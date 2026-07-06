import React, { useState } from 'react';
import { RequestComposer } from './postman/RequestComposer';
import { ResponseInspector } from './postman/ResponseInspector';

export const PostmanWorkspace: React.FC = () => {
  const [httpMethod, setHttpMethod] = useState('GET');
  const [requestUrl, setRequestUrl] = useState('https://api.github.com/repos/facebook/react');
  const [postmanResponse, setPostmanResponse] = useState<any>(null);
  const [isPostmanLoading, setIsPostmanLoading] = useState(false);

  const handleSendPostmanRequest = () => {
    setIsPostmanLoading(true);
    setTimeout(() => {
      setPostmanResponse({
        id: 10270250,
        node_id: 'MDEwOlJlcG9zaXRvcnkxMDI3MDI1MA==',
        name: 'react',
        full_name: 'facebook/react',
        private: false,
        owner: {
          login: 'facebook',
          id: 6919,
          type: 'Organization'
        },
        html_url: 'https://github.com/facebook/react',
        description: 'The library for web and native user interfaces.',
        stargazers_count: 224050,
        open_issues_count: 1422
      });
      setIsPostmanLoading(false);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <RequestComposer
        httpMethod={httpMethod}
        setHttpMethod={setHttpMethod}
        requestUrl={requestUrl}
        setRequestUrl={setRequestUrl}
        isPostmanLoading={isPostmanLoading}
        onSend={handleSendPostmanRequest}
      />

      {/* Params / Headers toggle tab mockup */}
      <div className="flex gap-4 border-b border-border-dark text-xs shrink-0 select-none">
        <span className="py-1 border-b border-accent text-accent font-semibold cursor-pointer">
          Params
        </span>
        <span className="py-1 text-zinc-555 hover:text-zinc-350 cursor-pointer">Headers</span>
        <span className="py-1 text-zinc-555 hover:text-zinc-350 cursor-pointer">Body (JSON)</span>
      </div>

      <ResponseInspector postmanResponse={postmanResponse} isPostmanLoading={isPostmanLoading} />
    </div>
  );
};
