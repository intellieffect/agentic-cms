'use client'

import { AbsoluteFill } from './AbsoluteFill'
import { Watermark } from './Watermark'
import { BRXCE_BRAND } from '../brand'
import type { StepByStepProps, Step } from '../types'

const ProgressBar: React.FC<{ current: number; total: number; accentColor: string }> = ({ current, total, accentColor }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: BRXCE_BRAND.colors.surface }}>
    <div style={{ width: `${(current / total) * 100}%`, height: '100%', backgroundColor: accentColor, borderRadius: '0 3px 3px 0' }} />
  </div>
)

const CoverSlide: React.FC<{ title: string; subtitle?: string; totalSteps: number; accentColor: string }> = ({ title, subtitle, totalSteps, accentColor }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80, justifyContent: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
      <div style={{ padding: '8px 20px', borderRadius: 8, backgroundColor: accentColor, fontSize: 16, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 700, color: '#FFFFFF', letterSpacing: 1 }}>{totalSteps}단계 가이드</div>
    </div>
    <h1 style={{ fontSize: 60, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: BRXCE_BRAND.colors.text, lineHeight: 1.25, letterSpacing: -1.5, margin: 0 }}>{title}</h1>
    {subtitle && <p style={{ fontSize: 26, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.6, margin: 0, marginTop: 24 }}>{subtitle}</p>}
    <div style={{ display: 'flex', gap: 12, marginTop: 64 }}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: BRXCE_BRAND.colors.surface }} />
      ))}
    </div>
    <Watermark />
  </AbsoluteFill>
)

const StepSlide: React.FC<{ step: Step; stepNumber: number; totalSteps: number; accentColor: string }> = ({ step, stepNumber, totalSteps, accentColor }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80 }}>
    <ProgressBar current={stepNumber} total={totalSteps} accentColor={accentColor} />
    <div style={{ marginTop: 40, marginBottom: 48, display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 32, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: '#FFFFFF' }}>{stepNumber}</span>
      </div>
      <span style={{ fontSize: 18, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 500, color: BRXCE_BRAND.colors.textMuted, letterSpacing: 1 }}>STEP {stepNumber} of {totalSteps}</span>
    </div>
    {step.emoji && <span style={{ fontSize: 48, marginBottom: 24 }}>{step.emoji}</span>}
    <h2 style={{ fontSize: 48, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 700, color: BRXCE_BRAND.colors.text, lineHeight: 1.3, letterSpacing: -0.5, margin: 0, marginBottom: 32 }}>{step.title}</h2>
    <div style={{ width: 48, height: 3, backgroundColor: accentColor, borderRadius: 2, marginBottom: 32 }} />
    <p style={{ fontSize: 26, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{step.description}</p>
    <div style={{ position: 'absolute', bottom: 80, left: 80, display: 'flex', gap: 10 }}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} style={{ width: i === stepNumber - 1 ? 32 : 12, height: 12, borderRadius: 6, backgroundColor: i === stepNumber - 1 ? accentColor : BRXCE_BRAND.colors.surface }} />
      ))}
    </div>
    <Watermark />
  </AbsoluteFill>
)

export const StepByStep: React.FC<StepByStepProps> = ({
  slideIndex, steps, guideTitle, guideSubtitle, accentColor = BRXCE_BRAND.colors.accent,
}) => {
  if (slideIndex === 0) return <CoverSlide title={guideTitle} subtitle={guideSubtitle} totalSteps={steps.length} accentColor={accentColor} />
  const step = steps[slideIndex - 1]
  if (!step) return null
  return <StepSlide step={step} stepNumber={slideIndex} totalSteps={steps.length} accentColor={accentColor} />
}
