import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowUpTrayIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  InformationCircleIcon,
  ListBulletIcon,
  LightBulbIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  SignalIcon,
  StopIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { coefficientOfVariation } from '../utils/coefficientOfVariation';
import './SpeechDashboard.css';

const FEATURES = [
  { id: 'vocabulary', label: 'Vocabulary variety', description: 'Measures the range of unique words used in the speech.', icon: ChatBubbleLeftRightIcon },
  { id: 'response', label: 'Response length', description: 'Looks at how fully ideas are expressed across the response.', icon: ChatBubbleLeftRightIcon },
  { id: 'sentence', label: 'Sentence complexity', description: 'Reviews sentence length and how ideas are connected.', icon: DocumentTextIcon },
  { id: 'pace', label: 'Speech pace', description: 'Shows how steadily the speaker moves through the response.', icon: SignalIcon },
  { id: 'pause', label: 'Pause pattern', description: 'Summarizes the placement and consistency of pauses.', icon: PauseCircleIcon },
  { id: 'repetition', label: 'Repetition pattern', description: 'Tracks repeated words and phrases across the recording.', icon: ArrowPathIcon },
  { id: 'clarity', label: 'Transcription clarity', description: 'Reflects how clearly the recording can be heard and transcribed.', icon: MicrophoneIcon },
  { id: 'emotion', label: 'Emotional tone', description: 'Summarizes the emotional expression detected in the speech.', icon: UserCircleIcon },
];

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatScore = (value) => value === null ? '—' : Number(value.toFixed(1)).toString();

const recordingKey = (recording) =>
  recording?.s3MetaKey || recording?._id || recording?.createdAt || '';

const recordingAnalysis = (recording) => ({
  ...(recording?.analysis || {}),
  transcribedText: recording?.transcribedText || recording?.analysis?.transcribedText || '',
});

const scoreFor = (featureId, analysis, rounded = true) => {
  if (!analysis) return null;
  const normalizeScore = (value) => rounded ? Math.round(clamp(value)) : clamp(value);
  const directScores = {
    vocabulary: analysis.vocabularyVariety,
    response: analysis.responseLength,
    sentence: analysis.sentenceStructure,
    pace: analysis.speechPace,
    pause: analysis.pausePattern,
    repetition: analysis.repetitionPattern,
    clarity: analysis.recordingClarity,
    emotion: analysis.emotionalTone,
  };
  const direct = finiteNumber(directScores[featureId]);
  if (direct !== null) return normalizeScore(direct);

  if (featureId === 'vocabulary') {
    const diversity = finiteNumber(analysis.diversityScore);
    return diversity === null ? null : normalizeScore(diversity * 100);
  }
  if (featureId === 'response') {
    const words = finiteNumber(analysis.totalWords);
    return words === null ? null : normalizeScore(words * 1.25);
  }
  if (featureId === 'sentence') {
    const average = finiteNumber(analysis.avgSentenceLength);
    const conjunctions = finiteNumber(analysis.conjunctionCount) || 0;
    return average === null ? null : normalizeScore(average * 4 + conjunctions * 2);
  }
  if (featureId === 'repetition') {
    const diversity = finiteNumber(analysis.diversityScore);
    return diversity === null ? null : normalizeScore(diversity * 100 - 15);
  }
  if (featureId === 'emotion') {
    const polarity = finiteNumber(analysis.polarityScore);
    return polarity === null ? null : normalizeScore((polarity + 1) * 50);
  }
  return null;
};

const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

function RadarChart({ current, reference }) {
  const centerX = 250;
  const centerY = 190;
  const radius = 142;
  const point = (index, scale) => {
    const angle = -Math.PI / 2 + index * (Math.PI / 4);
    return [centerX + Math.cos(angle) * radius * scale, centerY + Math.sin(angle) * radius * scale];
  };
  const polygon = (values) => values
    .map((value, index) => point(index, (value || 0) / 100).join(','))
    .join(' ');
  const labelPositions = FEATURES.map((_, index) => point(index, 1.23));
  const hasCurrentData = current.some((value) => value !== null);
  const hasReferenceData = reference.some((value) => value !== null);

  return (
    <svg className="radar-chart" viewBox="0 0 500 405" role="img" aria-label="Speech feature comparison radar chart">
      {[0.2, 0.4, 0.6, 0.8, 1].map((scale) => (
        <polygon key={scale} points={FEATURES.map((_, index) => point(index, scale).join(',')).join(' ')} className="radar-grid" />
      ))}
      {FEATURES.map((feature, index) => {
        const [x, y] = point(index, 1);
        return <line key={feature.id} x1={centerX} y1={centerY} x2={x} y2={y} className="radar-grid" />;
      })}
      {hasReferenceData && <polygon points={polygon(reference)} className="radar-reference" />}
      {hasCurrentData && <polygon points={polygon(current)} className="radar-current" />}
      {hasCurrentData && current.map((value, index) => {
        if (value === null) return null;
        const [x, y] = point(index, value / 100);
        return <circle key={FEATURES[index].id} cx={x} cy={y} r="4.5" className="radar-dot" />;
      })}
      {labelPositions.map(([x, y], index) => {
        const words = FEATURES[index].label.split(' ');
        const midpoint = Math.ceil(words.length / 2);
        const lines = words.length > 1
          ? [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
          : words;
        const anchor = x < centerX - 25 ? 'end' : x > centerX + 25 ? 'start' : 'middle';
        return (
          <text key={FEATURES[index].id} x={x} y={y} textAnchor={anchor} className="radar-label">
            {lines.map((line, lineIndex) => (
              <tspan key={line} x={x} dy={lineIndex === 0 ? 0 : 17}>{line}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

function BarChart({ items, reference, featureLabel }) {
  const top = 18;
  const bottom = 152;
  const chartHeight = bottom - top;
  const groupWidth = 470 / Math.max(items.length, 1);

  return (
    <svg className="bar-chart" viewBox="0 0 540 205" role="img" aria-label={`${featureLabel} scores across recordings, out of 100`}>
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = bottom - chartHeight * fraction;
        return (
          <g key={fraction}>
            <line x1="42" y1={y} x2="526" y2={y} className="bar-grid" />
            <text x="35" y={y + 4} textAnchor="end" className="bar-axis-label">{Math.round(100 * fraction)}</text>
          </g>
        );
      })}
      {items.map((item, index) => {
        const x = 48 + index * groupWidth + groupWidth / 2;
        const height = ((item.score || 0) / 100) * chartHeight;
        return (
          <g key={item.label}>
            <title>{`${item.date}: ${item.score === null ? 'Not available' : `${formatScore(item.score)} / 100`}`}</title>
            <rect x={x - 15} y={bottom - height} width="30" height={height} rx="2" className={item.isCurrent ? 'bar-current' : 'bar-reference'} />
            {item.score === null && <text x={x} y={bottom - 8} textAnchor="middle" className="bar-axis-label">—</text>}
            <text x={x} y="173" textAnchor="middle" className="bar-label">{item.label}</text>
            {item.isCurrent && <text x={x} y="189" textAnchor="middle" className="bar-label">recording</text>}
          </g>
        );
      })}
      {reference !== null && <line x1="42" y1={bottom - reference / 100 * chartHeight} x2="526" y2={bottom - reference / 100 * chartHeight} className="bar-baseline" />}
      <text x="11" y="90" textAnchor="middle" transform="rotate(-90 11 90)" className="bar-axis-label">Score / 100</text>
    </svg>
  );
}

function ScoreSummary({ label, score, tone, subtitle }) {
  const safeScore = score ?? 0;
  return (
    <div className={`score-summary score-summary--${tone}`}>
      <span className="score-summary__label">{label}</span>
      {subtitle && <span className="score-summary__subtitle">{subtitle}</span>}
      <div className="score-summary__value-row"><strong>{formatScore(score)}</strong><span>/ 100</span></div>
      <div className="progress-track" aria-hidden="true"><span style={{ width: `${safeScore}%` }} /></div>
    </div>
  );
}

function DashboardDialog({ title, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button, select, a[href], input, textarea, [tabindex="0"]')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="modal-layer" onKeyDown={handleKeyDown}>
      <button className="modal-scrim" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <section className="dashboard-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title">
        <header><h2 id="dashboard-dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><XMarkIcon /></button></header>
        {children}
      </section>
    </div>
  );
}

function Dashboard() {
  const { user, logout, authFetch } = useAuth();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingLocalData, setIsLoadingLocalData] = useState(false);
  const [localAnalysisProgress, setLocalAnalysisProgress] = useState('');
  const [analysisLanguage, setAnalysisLanguage] = useState('auto');
  const [usingLocalData, setUsingLocalData] = useState(false);
  const [scores, setScores] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState([]);
  const [selectedCurrentKey, setSelectedCurrentKey] = useState('no-recording');
  const [selectedReferenceKey, setSelectedReferenceKey] = useState('baseline');
  const [dateRange, setDateRange] = useState('all');
  const [activePanel, setActivePanel] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [currentRecordingId, setCurrentRecordingId] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState('pace');
  const [studioOpen, setStudioOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const featureSelectRef = useRef(null);

  const fetchRecordings = useCallback(async (preferredKey) => {
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/recordings`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load saved recordings.');
      const sorted = [...data].sort((first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
      setRecordings(sorted);
      setUsingLocalData(false);
      if (sorted.length > 0) {
        const selected = sorted.find((recording) => recordingKey(recording) === preferredKey) || sorted[0];
        setSelectedCurrentKey(recordingKey(selected));
        setScores(recordingAnalysis(selected));
        setCurrentRecordingId(recordingKey(selected));
      } else {
        setSelectedCurrentKey('no-recording');
        setScores(null);
        setCurrentRecordingId(null);
      }
      setSelectedReferenceKey('baseline');
      return sorted;
    } catch (fetchError) {
      console.warn('Could not load saved recordings.', fetchError);
      return null;
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRecordings();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, [fetchRecordings]);

  const currentAnalysis = scores;
  const activeRecording = recordings.find((recording) => recordingKey(recording) === selectedCurrentKey);
  const previousRecordings = useMemo(() => !activeRecording ? [] : recordings.filter((recording) =>
    recordingKey(recording) !== selectedCurrentKey &&
    (!activeRecording || new Date(recording.createdAt) < new Date(activeRecording.createdAt))
  ).slice(0, 5), [recordings, selectedCurrentKey, activeRecording]);
  const isBaseline = selectedReferenceKey === 'baseline';
  const selectedReference = recordings.find((recording) => recordingKey(recording) === selectedReferenceKey);
  const referenceAnalysis = selectedReference ? recordingAnalysis(selectedReference) : null;
  const activeFeature = FEATURES.find((feature) => feature.id === selectedFeature) || FEATURES[0];
  const currentScores = FEATURES.map((feature) => scoreFor(feature.id, currentAnalysis));
  const baselineScores = FEATURES.map((feature) => {
    const values = previousRecordings.map((recording) => scoreFor(feature.id, recordingAnalysis(recording))).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  });
  const referenceScores = isBaseline ? baselineScores : FEATURES.map((feature) => scoreFor(feature.id, referenceAnalysis));
  const currentScore = scoreFor(activeFeature.id, currentAnalysis);
  const referenceScore = referenceScores[FEATURES.findIndex((feature) => feature.id === activeFeature.id)];
  const comparisonLabel = isBaseline ? 'Personal baseline' : 'Reference recording';
  const baselineDescription = previousRecordings.length ? `${previousRecordings.length}-recording average` : 'No earlier recordings';
  const visibleRecordings = recordings.filter((recording) => dateRange === 'all' ||
    Date.now() - new Date(recording.createdAt).getTime() <= Number(dateRange) * 86400000);
  const featureVariation = FEATURES.map((feature) => ({
    ...feature,
    ...coefficientOfVariation(visibleRecordings
      .filter((recording) => !recording.analysisStatus || recording.analysisStatus === 'completed')
      .map((recording) => scoreFor(feature.id, recordingAnalysis(recording), false))),
  }));
  const chartRecordings = isBaseline ? [...previousRecordings].reverse() : selectedReference ? [selectedReference] : [];
  const chartItems = [
    ...chartRecordings.map((recording, index) => ({
      label: isBaseline ? `Rec ${index + 1}` : 'Reference',
      score: scoreFor(activeFeature.id, recordingAnalysis(recording)),
      date: formatDate(recording.createdAt),
    })),
    { label: 'Current', score: currentScore, isCurrent: true, date: formatDate(activeRecording?.createdAt) },
  ];

  const userName = user?.name || 'Emir Bey';
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const selectRecording = (key) => {
    setAnalysisLanguage('auto');
    if (key === 'no-recording') {
      setSelectedCurrentKey(key);
      setScores(null);
      setCurrentRecordingId(null);
      return;
    }
    const recording = recordings.find((item) => recordingKey(item) === key);
    if (!recording) return;
    setSelectedCurrentKey(key);
    setScores(recordingAnalysis(recording));
    setCurrentRecordingId(recordingKey(recording));
    if (key === selectedReferenceKey) setSelectedReferenceKey('baseline');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setFile(new File([audioBlob], `kina-recording.${extension}`, { type: mimeType }));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setError('');
      timerRef.current = setInterval(() => setRecordingTime((time) => time + 1), 1000);
    } catch (recordingError) {
      console.error('Microphone access failed.', recordingError);
      setError('Microphone access was blocked. Allow access or upload a WAV file instead.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const closeStudio = () => {
    if (isRecording) stopRecording();
    setStudioOpen(false);
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    const isWav = selected && (selected.type === 'audio/wav' || selected.name.toLowerCase().endsWith('.wav'));
    if (!isWav) {
      setFile(null);
      setError('Please select a WAV audio file.');
      return;
    }
    setFile(selected);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Record or select a WAV file first.');
      return;
    }
    setIsUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('audio', file);
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/audio`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Analysis failed.');
      setScores(data);
      setUsingLocalData(false);
      setCurrentRecordingId(data.recordingId || data.s3MetaKey || null);
      setSelectedCurrentKey(data.recordingId || data.s3MetaKey || 'latest-recording');
      setStudioOpen(false);
      setNotice('Recording analyzed successfully.');
      await fetchRecordings(data.recordingId || data.s3MetaKey);
    } catch (uploadError) {
      setError(uploadError.message || 'The recording could not be analyzed.');
    } finally {
      setIsUploading(false);
    }
  };

  const addLocalFiles = async () => {
    setIsLoadingLocalData(true);
    try {
      setLocalAnalysisProgress('Preparing local speech analysis…');
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/stored-recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisLanguage === 'auto' ? {} : { ids: [selectedCurrentKey], language: analysisLanguage }),
      });
      let progress = await response.json();
      if (!response.ok) throw new Error(progress.message || 'Local speech analysis could not start.');
      while (progress.state === 'running') {
        setLocalAnalysisProgress(`Analyzing local recordings: ${progress.completed} of ${progress.total} finished${progress.currentFile ? ` · ${progress.currentFile}` : ''}`);
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const statusResponse = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/analysis-status`);
        progress = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(progress.message || 'Could not check analysis progress.');
      }
      const localRecordings = await fetchRecordings(selectedCurrentKey);
      if (!localRecordings) throw new Error('Local files could not be loaded. Please try again.');
      setDateRange('all');
      const failed = localRecordings.filter((recording) => recording.analysisStatus === 'failed');
      showNotice(failed.length ? `${failed.length} recording${failed.length === 1 ? '' : 's'} could not be analyzed. Select a file to see the reason.` : localRecordings.length
        ? `Loaded ${localRecordings.length} local recording${localRecordings.length === 1 ? '' : 's'}. Select a file from the recording list.`
        : 'No recordings are stored in the local backend yet.');
    } catch (localFilesError) {
      showNotice(localFilesError.message || 'Local files could not be loaded.');
    } finally {
      setIsLoadingLocalData(false);
      setLocalAnalysisProgress('');
    }
  };

  const loadLocalComparisons = async () => {
    setIsLoadingLocalData(true);
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/local-recordings`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Local comparison data could not be loaded.');
      if (!Array.isArray(data) || data.length < 2) {
        throw new Error('At least two local sessions are required for comparison.');
      }

      const sorted = [...data].sort((first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
      setRecordings(sorted);
      setSelectedCurrentKey(recordingKey(sorted[0]));
      setSelectedReferenceKey('baseline');
      setScores(recordingAnalysis(sorted[0]));
      setCurrentRecordingId(recordingKey(sorted[0]));
      setUsingLocalData(true);
      showNotice(`Loaded ${sorted.length} local comparison sessions.`);
    } catch (localDataError) {
      showNotice(localDataError.message || 'Local comparison data could not be loaded.');
    } finally {
      setIsLoadingLocalData(false);
    }
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  };

  const insightText = currentScore === null
    ? `No ${activeFeature.label.toLowerCase()} data yet. Complete an analysis to populate this feature.`
    : referenceScore === null
      ? `Your ${activeFeature.label.toLowerCase()} score is ${currentScore} out of 100. ${isBaseline ? 'Earlier recordings are needed to calculate your personal baseline.' : 'Select a reference recording to compare changes.'}`
      : currentScore === referenceScore
        ? `Your ${activeFeature.label.toLowerCase()} score matches your ${comparisonLabel.toLowerCase()} of ${formatScore(referenceScore)} out of 100.`
        : `Your ${activeFeature.label.toLowerCase()} score is ${currentScore} out of 100, which is ${formatScore(Math.abs(currentScore - referenceScore))} points ${currentScore > referenceScore ? 'above' : 'below'} your ${comparisonLabel.toLowerCase()} of ${formatScore(referenceScore)}.`;

  const openPanel = (panel) => {
    setActivePanel(panel);
    setMobileNavOpen(false);
    setUserMenuOpen(false);
  };

  const changeDateRange = (range) => {
    setDateRange(range);
    const available = recordings.filter((recording) => range === 'all' || Date.now() - new Date(recording.createdAt).getTime() <= Number(range) * 86400000);
    if (!available.some((recording) => recordingKey(recording) === selectedCurrentKey)) {
      selectRecording(available.length ? recordingKey(available[0]) : 'no-recording');
    }
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    setFeedbackSending(true);
    setFeedbackStatus('');
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: feedback }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to send feedback.');
      setFeedback('');
      setFeedbackStatus('Thank you for your feedback.');
    } catch (feedbackError) { setFeedbackStatus(feedbackError.message); }
    finally { setFeedbackSending(false); }
  };

  const deleteSelectedRecording = async () => {
    if (!activeRecording || !window.confirm('Delete this recording and its analysis? This cannot be undone.')) return;
    try {
      const response = await authFetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/recordings/${encodeURIComponent(recordingKey(activeRecording))}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Unable to delete the recording.');
      }
      await fetchRecordings();
      showNotice('Recording and analysis deleted.');
      setActivePanel(null);
    } catch (deleteError) { setError(deleteError.message); }
  };

  const downloadReport = () => {
    const report = [
      'KinaBot — Speech Analysis',
      `Recording: ${formatDate(activeRecording?.createdAt, true)}`,
      `Comparison: ${comparisonLabel}${isBaseline ? ` (${baselineDescription})` : ` (${formatDate(selectedReference?.createdAt)})`}`,
      ...(usingLocalData ? ['Source: synthetic local comparison data'] : []),
      '',
      'Feature | Current score / 100 | Comparison score / 100',
      ...FEATURES.map((feature, index) => `${feature.label} | ${formatScore(currentScores[index])} | ${formatScore(referenceScores[index])}`),
      '',
      'Changes describe speech patterns and do not indicate a diagnosis.',
      ...(currentAnalysis?.transcribedText ? ['', 'Transcript', currentAnalysis.transcribedText] : []),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kinabot-speech-analysis.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="analysis-app">
      <header className="analysis-topbar">
        <button className="icon-button mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Bars3Icon /></button>
        <div className="analysis-brand">KinaBot</div>
        <div className="analysis-filters">
          <label><span>Select Recording</span><div className="select-wrap">
            <select aria-label="Select recording" value={selectedCurrentKey} onChange={(event) => selectRecording(event.target.value)}>
              {visibleRecordings.length === 0 && <option value="no-recording">{recordings.length ? 'No recordings in range' : 'No recordings yet'}</option>}
              {visibleRecordings.map((recording) => <option key={recordingKey(recording)} value={recordingKey(recording)}>{recording.fileName || (recordingKey(recording) === recordingKey(recordings[0]) ? 'Latest recording' : 'Recording')} ({formatDate(recording.createdAt)})</option>)}
            </select><ChevronDownIcon />
          </div></label>
          <label><span>Compare Against</span><div className="select-wrap">
            <select aria-label="Compare against" value={selectedReferenceKey} onChange={(event) => setSelectedReferenceKey(event.target.value)}>
              <option value="baseline">Personal baseline ({previousRecordings.length ? `${previousRecordings.length}-recording average` : 'up to 5 recordings'})</option>
              <option value="no-reference">No comparison</option>
              {recordings.filter((recording) => recordingKey(recording) !== selectedCurrentKey).map((recording) => <option key={recordingKey(recording)} value={recordingKey(recording)}>{recording.fileName || 'Recording'} ({formatDate(recording.createdAt)})</option>)}
            </select><ChevronDownIcon />
          </div></label>
          <label><span>Date Range</span><div className="select-wrap select-wrap--date">
            <CalendarDaysIcon /><select aria-label="Date range" value={dateRange} onChange={(event) => changeDateRange(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option><option value="all">All time</option></select><ChevronDownIcon />
          </div></label>
        </div>
      </header>

      <div className="analysis-layout">
        {mobileNavOpen && <button className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
        <aside className={`analysis-sidebar ${mobileNavOpen ? 'analysis-sidebar--open' : ''}`}>
          <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><XMarkIcon /></button>
          <nav aria-label="Dashboard navigation">
            <button className="sidebar-link sidebar-link--active" onClick={() => { setActiveSection('overview'); setMobileNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><HomeIcon /><span>Home</span></button>
            <div className="sidebar-section-label"><ChartBarIcon /><span>Speech Analysis</span></div>
            <div className="sidebar-subnav">
              <button className={activeSection === 'overview' ? 'sidebar-subnav__active' : ''} aria-current={activeSection === 'overview' ? 'page' : undefined} onClick={() => { setActiveSection('overview'); setMobileNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Overview</button>
              <button onClick={() => { setActiveSection('details'); openPanel('feature'); }}>Feature Details</button>
              <button onClick={() => openPanel('history')}>Recording History</button>
              <button onClick={() => openPanel('baseline')}>Baseline Information</button>
            </div>
            <div className="sidebar-divider" />
            <button className="sidebar-link" onClick={() => openPanel('progress')}><ChartBarIcon /><span>My Progress</span></button>
            <button className="sidebar-link" onClick={() => openPanel('reports')}><DocumentTextIcon /><span>Reports</span></button>
            <button className="sidebar-link" onClick={() => openPanel('settings')}><Cog6ToothIcon /><span>Settings</span></button>
            {import.meta.env.VITE_PILOT_MODE === 'true' && <button className="sidebar-link" onClick={() => openPanel('feedback')}><ChatBubbleLeftRightIcon /><span>Feedback</span></button>}
          </nav>
          <div className="sidebar-footer">
            <button className="sidebar-record-button" onClick={() => { setStudioOpen(true); setMobileNavOpen(false); }}><MicrophoneIcon />New recording</button>
            <div className="account-menu">
              <button className="account-menu__trigger" onClick={() => setUserMenuOpen((open) => !open)} aria-expanded={userMenuOpen}><span className="account-avatar">{initials}</span><span>{userName}</span><ChevronDownIcon /></button>
              {userMenuOpen && <div className="account-menu__popover"><button onClick={() => openPanel('settings')}>Account settings</button><button onClick={logout}>Sign out</button></div>}
            </div>
          </div>
        </aside>

        <main className="analysis-content">
          <section className="analysis-heading-row">
            <div>
              <div className="title-with-status">
                <h1>Speech Analysis</h1>
                {usingLocalData && <span className="local-data-badge">Local comparison data</span>}
              </div>
              <p>{isBaseline ? `See how your current recording compares to your personal baseline${previousRecordings.length ? `, calculated from your last ${previousRecordings.length} recording${previousRecordings.length === 1 ? '' : 's'}` : ', calculated from up to 5 earlier recordings'}.` : 'See how your current recording compares to your selected reference across all eight speech features.'}</p>
              {localAnalysisProgress && <p role="status">{localAnalysisProgress}</p>}
            </div>
          </section>

          <section className="analysis-grid">
            <article className="analysis-card comparison-card">
              <div className="profile-header"><h2>Overall Feature Profile <InformationCircleIcon aria-label="Scores out of 100" /></h2><div className="chart-legend"><span><i className="legend-line legend-line--current" />Current recording</span><span><i className="legend-line legend-line--reference" /><span>{comparisonLabel}{isBaseline && <small>({baselineDescription})</small>}</span></span></div></div>
              <RadarChart current={currentScores} reference={referenceScores} />
              {(!currentAnalysis || ['pending', 'processing', 'failed'].includes(activeRecording?.analysisStatus)) && (
                <div className="chart-empty-state">
                  <strong>{localAnalysisProgress ? 'Analyzing recordings' : activeRecording?.analysisStatus === 'failed' ? 'Analysis could not finish' : 'No analysis yet'}</strong>
                  <span>{activeRecording?.analysisError || 'Add local files or create a new recording to populate your speech profile.'}</span>
                  {activeRecording?.analysisStatus === 'failed' && <label>Recording language<div className="select-wrap"><select aria-label="Recording language" value={analysisLanguage} onChange={(event) => setAnalysisLanguage(event.target.value)} disabled={isLoadingLocalData}><option value="auto">Detect automatically</option><option value="en">English</option><option value="ja">Japanese</option><option value="zh">Chinese</option></select><ChevronDownIcon /></div></label>}
                  <div className="chart-empty-state__actions">
                    <button onClick={() => setStudioOpen(true)}><MicrophoneIcon />New recording</button>
                    <button className="chart-empty-state__secondary" onClick={addLocalFiles} disabled={isLoadingLocalData}>
                      <FolderIcon />{isLoadingLocalData ? 'Analyzing…' : 'Add local files'}
                    </button>
                  </div>
                </div>
              )}
            </article>

            <article className="analysis-card detail-card">
              <header className="detail-card__header">
                <div><h2>Feature Comparison <InformationCircleIcon aria-label="Compare one speech feature" /></h2><p>Your current speech feature compared to your {comparisonLabel.toLowerCase()}{isBaseline && ` (${baselineDescription})`}.</p></div>
                <div className="select-wrap feature-select"><select aria-label="Select speech feature" ref={featureSelectRef} value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>{FEATURES.map((feature) => <option key={feature.id} value={feature.id}>{feature.label}</option>)}</select><ChevronDownIcon /></div>
              </header>
              <div className="score-comparison">
                <ScoreSummary label="Current recording" score={currentScore} tone="current" />
                <ScoreSummary label={comparisonLabel} score={referenceScore} tone="reference" subtitle={isBaseline ? `(${baselineDescription})` : formatDate(selectedReference?.createdAt)} />
              </div>
              <div className="detail-chart">
                <BarChart items={chartItems} reference={referenceScore} featureLabel={activeFeature.label} />
                <div className="bar-legend"><span><i className="legend-box legend-box--reference" />{isBaseline ? 'Earlier recordings' : 'Reference recording'}</span><span><i className="legend-line legend-line--reference" />{comparisonLabel}</span><span><i className="legend-box legend-box--current" />Current recording</span></div>
              </div>
              <div className="insight-callout"><LightBulbIcon /><div><strong>What this means</strong><p>{insightText}</p></div></div>
            </article>
          </section>

          <section className="analysis-card feature-panel">
            <div className="feature-panel__heading">
              <div><h2>All Speech Features</h2><p>Quick view of your current recording compared to your {comparisonLabel.toLowerCase()}{isBaseline && ` (${baselineDescription})`}.</p></div>
              <button className="new-recording-button" onClick={() => setStudioOpen(true)}><MicrophoneIcon />New recording</button>
            </div>
            <div className="feature-grid">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                const score = scoreFor(feature.id, currentAnalysis);
                const active = selectedFeature === feature.id;
                const reference = referenceScores[index];
                const delta = score !== null && reference !== null ? score - reference : null;
                return (
                  <button key={feature.id} className={`feature-tile ${active ? 'feature-tile--active' : ''}`} aria-pressed={active} title={feature.description} onClick={() => setSelectedFeature(feature.id)}>
                    <Icon className="feature-tile__icon" />
                    <span className="feature-tile__content"><strong>{feature.label}</strong><span className="feature-tile__score"><b>{score ?? '—'}</b><span>/ 100</span></span><span className="feature-tile__baseline">{isBaseline ? 'Baseline' : 'Reference'}: {formatScore(reference)}</span><i className="feature-progress"><i style={{ width: `${score || 0}%` }} /></i></span>
                    <InformationCircleIcon className="feature-tile__info" aria-hidden="true" />
                    {delta !== null && <span className={`feature-delta ${delta > 0 ? 'feature-delta--up' : delta < 0 ? 'feature-delta--down' : ''}`}>{delta > 0 ? <ArrowUpIcon /> : delta < 0 ? <ArrowDownIcon /> : <span>↔</span>}{formatScore(Math.abs(delta))} <small>pts</small></span>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="analysis-card variation-panel" aria-labelledby="variation-heading">
            <div className="variation-panel__heading">
              <h2 id="variation-heading">Coefficient of variation</h2>
              <p>Across recordings in the selected date range.</p>
            </div>
            <dl className="variation-grid">
              {featureVariation.map((feature) => (
                <div key={feature.id} className="variation-item">
                  <dt>{feature.label}</dt>
                  <dd title={feature.cv === null ? undefined : `Mean: ${feature.mean.toFixed(2)}; sample standard deviation: ${feature.standardDeviation.toFixed(2)}`}>
                    <strong>{feature.cv === null ? '—' : `${feature.cv.toFixed(1)}%`}</strong>
                    <span>{feature.count} recording{feature.count === 1 ? '' : 's'}{feature.cv === null ? feature.count < 2 ? ' · Need at least 2' : ' · Mean is zero' : ''}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="variation-panel__note">CV = sample standard deviation ÷ mean × 100%. Missing scores are excluded.</p>
          </section>

          {(currentAnalysis?.transcribedText || currentAnalysis?.transcribed_text) && (
            <section className="analysis-card transcript-card"><div><ListBulletIcon /><h2>Transcript</h2></div><p>{currentAnalysis.transcribedText || currentAnalysis.transcribed_text}</p></section>
          )}
        </main>
      </div>

      {activePanel && (
        <DashboardDialog title={{ baseline: 'About your personal baseline', history: 'Recording history', progress: 'My progress', reports: 'Speech analysis report', settings: 'Account settings', feature: 'Speech feature details', feedback: 'Send feedback' }[activePanel]} onClose={() => { setActivePanel(null); setActiveSection('overview'); }}>
          {activePanel === 'feedback' && <form onSubmit={submitFeedback}>
            <p>Tell us what worked or what could be improved. You can also request account deletion here. Please avoid including sensitive information.</p>
            <label htmlFor="pilot-feedback">Your feedback</label>
            <textarea id="pilot-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={4000} required rows={5} className="w-full border border-gray-300 rounded-md p-3 my-3" />
            <button className="dialog-primary-button" type="submit" disabled={feedbackSending}>{feedbackSending ? 'Sending…' : 'Send feedback'}</button>
            {feedbackStatus && <p role="status">{feedbackStatus}</p>}
          </form>}
          {activePanel === 'baseline' && <>
            <p>Your personal baseline is the average of up to five recordings made before the selected recording. The current recording is excluded, and each speech feature keeps its existing scoring calculation.</p>
            <div className="dialog-note"><InformationCircleIcon /><span>{previousRecordings.length ? `This baseline uses ${previousRecordings.length} earlier recording${previousRecordings.length === 1 ? '' : 's'}.` : 'Select a recording with earlier sessions to build a baseline.'} Missing feature scores are excluded from that feature’s average.</span></div>
            <p>The date range filters the recordings you can select. Your baseline can still use earlier recordings outside that range.</p>
            {previousRecordings.length > 0 && <ul className="baseline-recordings">{previousRecordings.map((recording) => <li key={recordingKey(recording)}><ClockIcon />{formatDate(recording.createdAt, true)}</li>)}</ul>}
          </>}
          {(activePanel === 'history' || activePanel === 'progress') && <>
            <p>{activePanel === 'progress' ? `Your ${activeFeature.label.toLowerCase()} scores over time. Select a recording to explore all eight features.` : 'Select a recording to view its speech profile. The date range above also applies here.'}</p>
            {visibleRecordings.length ? <div className="history-list">{[...visibleRecordings].reverse().map((recording) => <button key={recordingKey(recording)} onClick={() => { selectRecording(recordingKey(recording)); setActivePanel(null); }}><span><CalendarDaysIcon /><span><strong>{recording.fileName || formatDate(recording.createdAt)}</strong><small>{recording.analysisStatus === 'pending' ? 'Stored locally · Analysis pending' : recording.localData ? 'Local comparison session' : 'Speech recording'}</small></span></span><span>{activePanel === 'progress' ? `${formatScore(scoreFor(activeFeature.id, recordingAnalysis(recording)))} / 100` : recordingKey(recording) === selectedCurrentKey ? 'Current' : 'View'}<ChevronRightIcon /></span></button>)}</div> : <div className="dialog-empty">No recordings in this date range. Choose a wider range or create a recording.</div>}
            <button className="dialog-secondary-button" onClick={() => { setActivePanel(null); setStudioOpen(true); }}><MicrophoneIcon />New recording</button>
          </>}
          {activePanel === 'feature' && <>
            <label className="dialog-feature-label">Speech feature<div className="select-wrap"><select aria-label="Feature details selection" value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>{FEATURES.map((feature) => <option key={feature.id} value={feature.id}>{feature.label}</option>)}</select><ChevronDownIcon /></div></label>
            <p>{activeFeature.description}</p>
            <div className="score-comparison"><ScoreSummary label="Current recording" score={currentScore} tone="current" /><ScoreSummary label={comparisonLabel} score={referenceScore} tone="reference" /></div>
            <p>{insightText}</p>
            {['vocabulary', 'response', 'sentence'].includes(selectedFeature) && <dl className="feature-metrics">
              {selectedFeature !== 'sentence' && <><div><dt>Total words</dt><dd>{currentAnalysis?.totalWords ?? '—'}</dd></div>{selectedFeature === 'vocabulary' && <div><dt>Unique words</dt><dd>{currentAnalysis?.uniqueWords ?? '—'}</dd></div>}</>}
              {selectedFeature === 'sentence' && <><div><dt>Average words per sentence</dt><dd>{currentAnalysis?.avgSentenceLength ?? '—'}</dd></div><div><dt>Conjunctions</dt><dd>{currentAnalysis?.conjunctionCount ?? '—'}</dd></div></>}
            </dl>}
          </>}
          {activePanel === 'reports' && <>
            <p>Download the selected recording’s eight speech feature scores and {comparisonLabel.toLowerCase()} as a text report.</p>
            <div className="report-preview"><DocumentTextIcon /><div><strong>Speech analysis</strong><span>{formatDate(activeRecording?.createdAt)} · 8 speech features</span>{usingLocalData && <small>Synthetic local comparison data</small>}</div></div>
            <button className="dialog-primary-button" disabled={!currentAnalysis} onClick={downloadReport}><ArrowDownIcon />Download report</button>
          </>}
          {activePanel === 'settings' && <>
            <div className="settings-profile"><span className="account-avatar">{initials}</span><div><strong>{userName}</strong><p>{user?.email}</p></div></div>
            {import.meta.env.VITE_PILOT_MODE === 'true' && <><p>Your recordings, transcripts and results are stored on the pilot server. Select a recording above to delete it, or use Feedback to request account deletion.</p><button className="dialog-secondary-button" onClick={deleteSelectedRecording} disabled={!activeRecording || usingLocalData}>Delete selected recording</button></>}
            <button className="dialog-secondary-button" onClick={loadLocalComparisons} disabled={isLoadingLocalData}><FolderIcon />{isLoadingLocalData ? 'Loading…' : 'Load local comparison data'}</button>
            <button className="dialog-secondary-button" onClick={logout}>Sign out</button>
          </>}
        </DashboardDialog>
      )}

      {studioOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="studio-title">
          <button className="modal-scrim" onClick={closeStudio} aria-label="Close recording studio" />
          <section className="recording-studio">
            <header>
              <div><span className="eyebrow">KinaBot recorder</span><h2 id="studio-title">Create a new analysis</h2><p>Record now or upload a WAV file from your device.</p></div>
              <button className="icon-button" onClick={closeStudio} aria-label="Close"><XMarkIcon /></button>
            </header>
            <div className="studio-grid">
              <button className={`record-control ${isRecording ? 'record-control--active' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
                <span className="record-control__icon">{isRecording ? <StopIcon /> : <MicrophoneIcon />}</span><strong>{isRecording ? 'Stop recording' : 'Start recording'}</strong><span>{isRecording ? formatTime(recordingTime) : 'Use your microphone'}</span>
              </button>
              <label className="upload-control">
                <span className="upload-control__icon"><ArrowUpTrayIcon /></span><strong>Add local files</strong><span>{file ? file.name : 'Choose a WAV file'}</span><input type="file" accept=".wav,audio/wav" onChange={handleFileChange} />
              </label>
            </div>
            {error && <div className="studio-error" role="alert">{error}</div>}
            <div className="studio-actions"><span>{file ? 'Ready to analyze' : 'No audio selected'}</span><button onClick={handleUpload} disabled={!file || isUploading}>{isUploading ? 'Analyzing…' : 'Analyze recording'}</button></div>
            {recordings.length > 0 && (
              <div className="recording-library">
                <h3>Recent recordings</h3>
                {recordings.slice(0, 4).map((recording) => (
                  <button key={recordingKey(recording)} onClick={() => { selectRecording(recordingKey(recording)); setStudioOpen(false); }}><span><ClockIcon />{formatDate(recording.createdAt, true)}</span><ChevronRightIcon /></button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
      <span className="sr-only">Current recording identifier: {currentRecordingId || 'none'}</span>
    </div>
  );
}

export default Dashboard;
