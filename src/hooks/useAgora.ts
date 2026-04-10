import { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack, IRemoteUser } from 'agora-rtc-sdk-ng';

const APP_ID = '12ac74be251f413ca10fe6e23bdaa669';

export function useAgora(roomId: string, userId: string | undefined, isOnMic: boolean) {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IRemoteUser[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId || !userId) return;

    const initAgora = async () => {
      const rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      rtcClient.enableAudioVolumeIndicator();

      rtcClient.on('volume-indicator', (volumes) => {
        const speaking = volumes.filter(v => v.level > 5).map(v => {
          // Agora uses uid 0 for the local user in volume indicators sometimes
          if (v.uid === 0 || v.uid === '0') return String(userId);
          return String(v.uid);
        });
        setSpeakingUsers(speaking);
      });

      rtcClient.on('user-published', async (user, mediaType) => {
        await rtcClient.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack?.play();
        }
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      rtcClient.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'audio') {
          user.audioTrack?.stop();
        }
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      rtcClient.on('user-joined', (user) => {
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      rtcClient.on('user-left', (user) => {
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      try {
        await rtcClient.join(APP_ID, roomId, null, userId);
        setClient(rtcClient);
        setIsJoined(true);
      } catch (error) {
        console.error('Agora join failed:', error);
      }
    };

    initAgora();

    return () => {
      if (client) {
        client.leave();
        setIsJoined(false);
      }
    };
  }, [roomId, userId]);

  useEffect(() => {
    const handleMicState = async () => {
      if (!client || !isJoined) return;

      if (isOnMic) {
        if (!localAudioTrack) {
          try {
            const track = await AgoraRTC.createMicrophoneAudioTrack();
            setLocalAudioTrack(track);
            await client.publish([track]);
          } catch (error) {
            console.error('Failed to create or publish audio track:', error);
          }
        }
      } else {
        if (localAudioTrack) {
          localAudioTrack.stop();
          localAudioTrack.close();
          if (client.localTracks.length > 0) {
            await client.unpublish([localAudioTrack]);
          }
          setLocalAudioTrack(null);
        }
      }
    };

    handleMicState();
  }, [isOnMic, client, isJoined]);

  const toggleMute = async () => {
    if (localAudioTrack) {
      const newMutedState = !isMuted;
      await localAudioTrack.setMuted(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  return {
    isJoined,
    isMuted,
    toggleMute,
    remoteUsers,
    speakingUsers
  };
}
