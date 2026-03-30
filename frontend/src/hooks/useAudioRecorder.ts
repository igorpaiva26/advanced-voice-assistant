import { useRef, useState, useCallback } from 'react';

type RecordingState = 'idle' | 'recording' | 'processing';

interface UseAudioRecorderResult {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Seu navegador não suporta acesso ao microfone.');
      return;
    }
    if (!window.MediaRecorder) {
      setError('Seu navegador não suporta gravação de áudio (MediaRecorder).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      setRecordingState('recording');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Permissão de microfone negada.');
      } else {
        setError(`Erro ao acessar microfone: ${err.message}`);
      }
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(null); return; }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecordingState('idle');
        resolve(blob);
      };
      setRecordingState('processing');
      recorder.stop();
    });
  }, []);

  return { recordingState, startRecording, stopRecording, error };
}
