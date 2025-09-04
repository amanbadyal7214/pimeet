import React, { useState, useEffect } from 'react';
import { SocketService } from '../../services/socket';

interface EntryRequest {
  userId: string;
  displayName: string;
  timestamp: string;
}

interface ServiceRequestPanelProps {
  onClose: () => void;
  isTrainer: boolean;
  meetingId?: string;
}

const ServiceRequestPanel: React.FC<ServiceRequestPanelProps> = ({ 
  onClose, 
  isTrainer, 
  meetingId 
}) => {
  const [entryRequests, setEntryRequests] = useState<EntryRequest[]>([]);
  const [autoApprove, setAutoApprove] = useState<boolean>(false);

  useEffect(() => {
    if (!isTrainer) return;

    const socket = SocketService.getInstance().getSocket();
    if (!socket) {
      console.log('No socket available for entry requests');
      return;
    }

    console.log('Setting up entry request listener, meetingId:', meetingId, 'autoApprove:', autoApprove);

    const handleEntryRequest = (payload: any) => {
      console.log('Entry request received:', payload);
      
      if (autoApprove) {
        console.log('Auto-approving entry for:', payload.displayName);
        // Auto-approve if enabled
        const socket = SocketService.getInstance().getSocket();
        if (socket && meetingId) {
          socket.emit('approve-entry', {
            roomId: meetingId,
            userId: payload.userId
          });
          console.log('Sent auto-approve for userId:', payload.userId, 'roomId:', meetingId);
        } else {
          console.error('Socket or meetingId not available for auto-approve:', { socket: !!socket, meetingId });
        }
        return;
      }

      setEntryRequests(prev => {
        // Check if request already exists
        const exists = prev.find(req => req.userId === payload.userId);
        if (exists) return prev;
        
        return [...prev, {
          userId: payload.userId,
          displayName: payload.displayName,
          timestamp: new Date().toISOString()
        }];
      });
    };

    socket.on('entry-request', handleEntryRequest);

    return () => {
      socket.off('entry-request', handleEntryRequest);
    };
  }, [isTrainer, autoApprove, meetingId]); // Added autoApprove and meetingId to dependencies

  const handleApproveEntry = (request: EntryRequest) => {
    const socket = SocketService.getInstance().getSocket();
    if (socket && meetingId) {
      socket.emit('approve-entry', {
        roomId: meetingId,
        userId: request.userId
      });

      // Remove from pending requests
      setEntryRequests(prev => prev.filter(req => req.userId !== request.userId));
    }
  };

  const handleDenyEntry = (request: EntryRequest) => {
    const socket = SocketService.getInstance().getSocket();
    if (socket && meetingId) {
      socket.emit('deny-entry', {
        roomId: meetingId,
        userId: request.userId
      });

      // Remove from pending requests
      setEntryRequests(prev => prev.filter(req => req.userId !== request.userId));
    }
  };

  if (!isTrainer) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-200 text-center max-w-xs sm:max-w-sm w-full">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-2">Access Restricted</h3>
          <p className="text-slate-600 text-xs sm:text-sm">This panel is only available for trainers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">Entry Requests</h3>
            <p className="text-xs text-slate-500">
              {autoApprove ? 'Auto-approve enabled' : `${entryRequests.length} pending request${entryRequests.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Auto-approve toggle */}
          <button
            onClick={() => {
              const newState = !autoApprove;
              console.log('Auto-approve toggled:', newState);
              setAutoApprove(newState);
            }}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              autoApprove 
                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={autoApprove ? 'Disable auto-approve' : 'Enable auto-approve'}
          >
            <svg className={`w-3 h-3 mr-1.5 transition-colors ${autoApprove ? 'text-green-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto
          </button>
          
          {entryRequests.length > 0 && !autoApprove && (
            <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mr-1 animate-pulse"></span>
              {entryRequests.length} New
            </span>
          )}
          {entryRequests.length > 0 && !autoApprove && (
            <span className="sm:hidden inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {entryRequests.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {autoApprove ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2 text-center">Auto-Approve Active</h3>
            <p className="text-slate-600 text-center text-xs sm:text-sm max-w-sm">
              All entry requests are being automatically approved. Users can join the meeting without waiting for manual approval.
            </p>
          </div>
        ) : entryRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2 text-center">No Pending Requests</h3>
            <p className="text-slate-600 text-center text-xs sm:text-sm max-w-sm">
              All entry requests have been processed. New requests will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {entryRequests.map((request, index) => (
              <div 
                key={`${request.userId}-${index}`} 
                className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex flex-col space-y-3">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-800 text-sm sm:text-base truncate">{request.displayName}</h4>
                      <p className="text-xs sm:text-sm text-slate-500">Wants to join the meeting</p>
                    </div>
                  </div>
                  
                  {/* Buttons always below */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleApproveEntry(request)}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => handleDenyEntry(request)}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md text-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceRequestPanel;
