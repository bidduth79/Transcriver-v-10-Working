import React from 'react';
import { uiText } from '../../../utils/uiText';

export const getGuideData = (appLang: 'bn' | 'en') => ({
    sidebar: {
      title: uiText(appLang, 'sidebar'),
      description: uiText(appLang, 'inputSourcesHistoryAndFileInformation'),
      items: [
        {
          title: uiText(appLang, 'n1InputMethods'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />,
          content: uiText(appLang, 'localFileUploadFromPcYoutube')
        },
        {
          title: uiText(appLang, 'n2ExpandedHistory'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
          content: uiText(appLang, 'viewPastWorkClickExpandArrow')
        },
        {
          title: uiText(appLang, 'n3FileInfo'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
          content: uiText(appLang, 'showsNameSizeDurationIncludesAudio')
        }
      ]
    },
    header: {
      title: uiText(appLang, 'header'),
      description: uiText(appLang, 'toolsSettingsAndSystemControls'),
      items: [
        {
          title: uiText(appLang, 'toolsUtility'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />,
          content: uiText(appLang, 'scissorsIconAccessCutterJoinerConverter')
        },
        {
          title: uiText(appLang, 'apiLogs'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
          content: uiText(appLang, 'keyIconManageApiKeysLog')
        },
        {
          title: uiText(appLang, 'systemControl'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
          content: uiText(appLang, 'controlsForFullscreenThemeLanguageStatus')
        }
      ]
    },
    footer: {
      title: uiText(appLang, 'footer'),
      description: uiText(appLang, 'serverConnectionAndApiStatusMonitoring'),
      items: [
        {
          title: uiText(appLang, 'n1ServerStatus'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />,
          content: uiText(appLang, 'greenXamppConnectedSavingDataRed')
        },
        {
          title: uiText(appLang, 'n2ApiSource'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
          content: uiText(appLang, 'showsActiveApiKeyIndicatesIf')
        },
        {
          title: uiText(appLang, 'n3ModelCalls'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
          content: uiText(appLang, 'modelCurrentAiEngineFlashPro')
        }
      ]
    },
    transcript: {
      title: uiText(appLang, 'transcript'),
      description: uiText(appLang, 'outputControlAnalysisAndExport'),
      items: [
        {
          title: uiText(appLang, 'n13SearchAnalysis'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
          content: uiText(appLang, 'searchHighlightsTextAnalysisIconGives')
        },
        {
          title: uiText(appLang, 'n45LangConverter'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />,
          content: uiText(appLang, 'translateButtonFlipsLanguageUB')
        },
        {
          title: uiText(appLang, 'n67FontDownload'),
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
          content: uiText(appLang, 'adjustFontSizeWithButtonsDownload')
        }
      ]
    }
});

export const getTabs = (appLang: 'bn' | 'en') => [
    { id: 'sidebar', label: uiText(appLang, 'sidebarAlt'), icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 00-2-2h-2a2 2 0 00-2 2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 00-2-2h-2a2 2 0 00-2 2" /> },
    { id: 'header', label: uiText(appLang, 'headerAlt'), icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /> },
    { id: 'footer', label: uiText(appLang, 'footerAlt'), icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /> },
    { id: 'transcript', label: uiText(appLang, 'transcriptAlt'), icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> }
];
