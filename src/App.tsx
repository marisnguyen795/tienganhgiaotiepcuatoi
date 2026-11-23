/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CheckCircle2, WifiOff, X } from 'lucide-react';
import { Domain, Situation, SITUATIONS } from './data';
import { useLocalProgress } from './hooks/useLocalProgress';
import { AppTab, TopBar } from './components/TopBar';
import { HomeDashboard } from './components/HomeDashboard';
import { DialoguePracticeView } from './components/DialoguePracticeView';
import { ReflexDrillView } from './components/ReflexDrillView';
import { VocabBankView } from './components/VocabBankView';
import { ProgressView } from './components/ProgressView';
import { VietToEngView } from './components/VietToEngView';
import { AIConversationView } from './components/AIConversationView';
import { AdminModal } from './components/AdminModal';
import { AdminConsoleView } from './components/AdminConsoleView';
import { KnowledgeLoaderModal } from './components/KnowledgeLoaderModal';
import {
  AIPreference,
  fetchLiveKnowledge,
  fetchLiveSituations,
  getStoredAIPreference,
  KnowledgeItem,
  saveStoredAIPreference,
  StoredSituation,
} from './utils/aiClient';
import { stopSpeaking } from './utils/speech';

const INITIAL_SITUATIONS: StoredSituation[] = SITUATIONS.map((s) => ({
  ...s,
  source: 'builtin',
}));

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedSituation, setSelectedSituation] = useState<Situation | null>(null);
  const [reflexInitialDomain, setReflexInitialDomain] = useState<Domain | 'Tất cả'>('Tất cả');
  const [aiPreference, setAiPreference] = useState<AIPreference>(() => getStoredAIPreference());
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [situations, setSituations] = useState<StoredSituation[]>(INITIAL_SITUATIONS);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);

  // Admin session token kept strictly in React memory
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [knowledgeLoaderState, setKnowledgeLoaderState] = useState<{
    open: boolean;
    topic: string;
  }>({ open: false, topic: '' });
  const [knowledgeToast, setKnowledgeToast] = useState<string | null>(null);

  const {
    progress,
    toggleMasteredSituation,
    toggleFavoriteSituation,
    toggleMasteredWord,
    recordDrillSession,
    resetAllProgress,
  } = useLocalProgress();

  const refreshCurriculum = useCallback(async () => {
    const [liveSits, liveKnow] = await Promise.all([
      fetchLiveSituations(),
      fetchLiveKnowledge(),
    ]);
    if (liveSits && liveSits.length > 0) {
      setSituations(liveSits);
    }
    if (liveKnow) {
      setKnowledge(liveKnow);
    }
  }, []);

  useEffect(() => {
    refreshCurriculum();
  }, [refreshCurriculum]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleChangePreference = (pref: AIPreference) => {
    setAiPreference(pref);
    saveStoredAIPreference(pref);
  };

  const handleSelectTab = (tab: AppTab) => {
    stopSpeaking();
    setSelectedSituation(null);
    if (tab === 'reflex') {
      setReflexInitialDomain('Tất cả');
    }
    if (tab === 'admin' && !adminToken) {
      setShowAdminModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleOpenAdmin = () => {
    stopSpeaking();
    setSelectedSituation(null);
    if (adminToken) {
      setActiveTab('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowAdminModal(true);
    }
  };

  const handleOpenSituation = (situation: Situation) => {
    stopSpeaking();
    setSelectedSituation(situation);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartReflexDrill = (domain: Domain | 'Tất cả' = 'Tất cả') => {
    stopSpeaking();
    setSelectedSituation(null);
    setReflexInitialDomain(domain);
    setActiveTab('reflex');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickStart = () => {
    const nextUnmastered =
      situations.find((s) => !progress.masteredSituationIds.includes(s.id)) ?? situations[0];
    if (nextUnmastered) {
      handleOpenSituation(nextUnmastered);
    }
  };

  const handleOpenKnowledgeLoader = (topic = '') => {
    setKnowledgeLoaderState({ open: true, topic });
  };

  const viewKey = selectedSituation ? `situation-${selectedSituation.id}` : activeTab;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex flex-col">
        <TopBar
          activeTab={activeTab}
          isAdmin={Boolean(adminToken)}
          onSelectTab={handleSelectTab}
          onQuickStart={handleQuickStart}
          onOpenAdmin={handleOpenAdmin}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-24 lg:pb-12">
          {!isOnline && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs sm:text-sm text-amber-900"
            >
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>Đang ngoại tuyến — Ứng dụng tiếp tục luyện tập bình thường ở chế độ Offline.</span>
            </div>
          )}

          {knowledgeToast && (
            <div
              role="status"
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                {knowledgeToast}
              </span>
              <button
                type="button"
                onClick={() => setKnowledgeToast(null)}
                aria-label="Đóng thông báo"
                className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {selectedSituation ? (
                <DialoguePracticeView
                  situation={selectedSituation}
                  progress={progress}
                  aiPreference={aiPreference}
                  onBack={() => setSelectedSituation(null)}
                  onToggleMasteredSituation={toggleMasteredSituation}
                  onToggleFavoriteSituation={toggleFavoriteSituation}
                  onToggleMasteredWord={toggleMasteredWord}
                />
              ) : activeTab === 'admin' && adminToken ? (
                <AdminConsoleView
                  adminToken={adminToken}
                  aiPreference={aiPreference}
                  onChangePreference={handleChangePreference}
                  onSituationsUpdated={refreshCurriculum}
                  onLogout={() => {
                    setAdminToken(null);
                    setActiveTab('home');
                  }}
                />
              ) : activeTab === 'home' ? (
                <HomeDashboard
                  situations={situations}
                  progress={progress}
                  onOpenSituation={handleOpenSituation}
                  onStartReflexDrill={handleStartReflexDrill}
                  onOpenVietToEng={() => handleSelectTab('viet_eng')}
                  onOpenAIChat={() => handleSelectTab('ai_chat')}
                  onOpenKnowledgeLoader={handleOpenKnowledgeLoader}
                  onToggleFavorite={toggleFavoriteSituation}
                />
              ) : activeTab === 'viet_eng' ? (
                <VietToEngView
                  situations={situations}
                  aiPreference={aiPreference}
                  onChangePreference={handleChangePreference}
                  onOpenKnowledgeLoader={handleOpenKnowledgeLoader}
                />
              ) : activeTab === 'ai_chat' ? (
                <AIConversationView
                  situations={situations}
                  progress={progress}
                  aiPreference={aiPreference}
                  onChangePreference={handleChangePreference}
                  onToggleMasteredSituation={toggleMasteredSituation}
                  onOpenKnowledgeLoader={handleOpenKnowledgeLoader}
                />
              ) : activeTab === 'reflex' ? (
                <ReflexDrillView
                  key={`reflex-${reflexInitialDomain}-${situations.length}`}
                  situations={situations}
                  initialDomain={reflexInitialDomain}
                  onRecordDrill={recordDrillSession}
                  onGoHome={() => handleSelectTab('home')}
                />
              ) : activeTab === 'vocab' ? (
                <VocabBankView
                  situations={situations}
                  knowledge={knowledge}
                  progress={progress}
                  onToggleMasteredWord={toggleMasteredWord}
                  onOpenKnowledgeLoader={handleOpenKnowledgeLoader}
                />
              ) : (
                <ProgressView
                  situations={situations}
                  progress={progress}
                  aiPreference={aiPreference}
                  onChangePreference={handleChangePreference}
                  onStartDomainDrill={(domain) => handleStartReflexDrill(domain)}
                  onResetProgress={resetAllProgress}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <AdminModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          onSuccess={(token) => {
            setAdminToken(token);
            setShowAdminModal(false);
            setActiveTab('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <KnowledgeLoaderModal
          key={knowledgeLoaderState.open ? `loader-${knowledgeLoaderState.topic}` : 'loader-closed'}
          isOpen={knowledgeLoaderState.open}
          defaultTopic={knowledgeLoaderState.topic}
          aiPreference={aiPreference}
          onClose={() => setKnowledgeLoaderState((prev) => ({ ...prev, open: false }))}
          onLoaded={(summary) => {
            setKnowledgeLoaderState({ open: false, topic: '' });
            setKnowledgeToast(summary);
            refreshCurriculum();
          }}
        />
      </div>
    </MotionConfig>
  );
}
