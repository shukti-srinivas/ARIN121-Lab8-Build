/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  FileText,
  ChevronRight,
  Layers,
  Award
} from 'lucide-react';

interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D' | string;
  text: string;
}

interface Question {
  id: number;
  question: string;
  options: QuestionOption[];
}

interface EvaluationResult {
  questionId: number;
  isCorrect: boolean;
  selectedOption: string;
  correctOption: string;
  explanation: string;
}

interface EvaluationResponse {
  score: number;
  total: number;
  summaryFeedback: string;
  results: EvaluationResult[];
}

const SAMPLE_NOTES = [
  {
    title: 'Cell Biology (ATP & Mitochondria)',
    emoji: '🧬',
    text: `Mitochondria are double-membraned organelles known as the powerhouses of eukaryotic cells. The outer membrane contains porins that allow small molecules to pass, while the inner membrane is folded into cristae to maximize surface area. The electron transport chain (ETC) is located in the inner mitochondrial membrane and creates a proton gradient across the intermembrane space. ATP synthase harnesses this electrochemical proton gradient (chemiosmosis) to synthesize ATP from ADP and inorganic phosphate. During oxidative phosphorylation, oxygen acts as the terminal electron acceptor, forming water. A net yield of approximately 30-32 ATP molecules is produced per glucose molecule during aerobic cellular respiration.`
  },
  {
    title: 'Computer Science (Algorithms & Big-O)',
    emoji: '⚡',
    text: `Time complexity analyzes how execution time grows with input size n. QuickSort has an average-case time complexity of O(n log n) and a worst-case of O(n^2), which occurs when the pivot is consistently the smallest or largest element (such as already sorted arrays with naive pivot selection). MergeSort guarantees O(n log n) in all cases (worst, average, and best) and is a stable sort, but requires O(n) auxiliary space. Binary search requires an array to be sorted and operates in O(log n) time by halving the search space each step. Hash tables achieve O(1) average-case time complexity for search, insertion, and deletion, but degrade to O(n) worst-case when high collision rates occur.`
  },
  {
    title: 'Macroeconomics (Fiscal & Monetary Policy)',
    emoji: '📈',
    text: `Fiscal policy involves government spending and taxation managed by the executive and legislative branches to influence aggregate demand. Expansionary fiscal policy increases government expenditure or reduces taxes to combat recessions, but can lead to budget deficits. Monetary policy is conducted by the central bank (e.g., the Federal Reserve) by controlling the money supply and key interest rates. To curb high inflation, central banks employ contractionary monetary policy by raising policy interest rates and selling government bonds in open market operations, which increases borrowing costs and reduces consumption and investment. The Phillips Curve historically illustrates an inverse short-run relationship between inflation and unemployment.`
  }
];

export default function App() {
  const [studyMaterial, setStudyMaterial] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Quiz state
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [submissionPrompt, setSubmissionPrompt] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});

  // Assessment results
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);

  const quizRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectSample = (sampleText: string) => {
    setStudyMaterial(sampleText);
    setGenError(null);
  };

  const handleGenerateQuiz = async () => {
    if (!studyMaterial.trim()) {
      setGenError('Please enter or paste your course notes / study material before generating a quiz.');
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    setGenError(null);
    setEvalError(null);
    setIsGenerating(true);
    setEvaluation(null);
    setSelectedAnswers({});

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyMaterial }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz. Please check your notes and try again.');
      }

      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('Received invalid quiz format from assistant.');
      }

      setQuestions(data.questions);
      setSubmissionPrompt(data.submissionPrompt || 'Please submit your answers using question numbers and option labels.');

      setTimeout(() => {
        quizRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setGenError(err.message || 'An unexpected error occurred while generating the quiz.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = (questionId: number, optionLabel: string) => {
    // If already evaluated, don't change without retake
    if (evaluation) return;

    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionLabel,
    }));
    setEvalError(null);
  };

  const handleSubmitAnswers = async () => {
    if (!questions || questions.length !== 3) return;

    // Check if any question is missing an answer
    const missing: number[] = [];
    questions.forEach((q) => {
      if (!selectedAnswers[q.id]) {
        missing.push(q.id);
      }
    });

    if (missing.length > 0) {
      setEvalError(
        `Answer missing for Question ${missing.join(', ')}. As per practice guidelines, please answer all 3 questions before submitting.`
      );
      return;
    }

    setEvalError(null);
    setIsEvaluating(true);

    try {
      const res = await fetch('/api/quiz/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyMaterial,
          questions,
          answers: selectedAnswers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to evaluate answers. Please try again.');
      }

      setEvaluation(data);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      setEvalError(err.message || 'An error occurred during quiz assessment.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRetakeQuiz = () => {
    setSelectedAnswers({});
    setEvaluation(null);
    setEvalError(null);
    setTimeout(() => {
      quizRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleResetAll = () => {
    setQuestions(null);
    setSelectedAnswers({});
    setEvaluation(null);
    setEvalError(null);
    setGenError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const answeredCount = questions ? questions.filter((q) => selectedAnswers[q.id]).length : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation / Brand */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 tracking-tight leading-tight">
                Interactive Quiz Generator
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                University Practice Quiz Assistant
              </p>
            </div>
          </div>
          {questions && (
            <button
              onClick={handleResetAll}
              className="text-xs sm:text-sm font-medium text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>Change Notes</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        
        {/* Intro Banner */}
        <section className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold mb-3 border border-indigo-400/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailored Study Assessment</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Test your understanding in 3 focused questions
            </h2>
            <p className="mt-2 text-indigo-100 text-sm sm:text-base leading-relaxed">
              Paste your course syllabus, lecture transcript, or study summary. The assistant strictly builds three multiple-choice questions from your text, evaluates your choices, and provides detailed explanations.
            </p>
          </div>
        </section>

        {/* Section 1: Study Material Input */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                1
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Course Notes or Study Material
              </h3>
            </div>
            {studyMaterial && (
              <button
                type="button"
                onClick={() => setStudyMaterial('')}
                className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
              >
                Clear text
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-2 font-medium">
              Or load sample university study notes:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_NOTES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(sample.text)}
                  className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium text-left"
                >
                  <span>{sample.emoji}</span>
                  <span>{sample.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              ref={inputRef}
              rows={7}
              value={studyMaterial}
              onChange={(e) => {
                setStudyMaterial(e.target.value);
                if (genError) setGenError(null);
              }}
              placeholder="Paste lecture notes, textbook excerpts, study guide summaries, or formulas here..."
              className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y leading-relaxed font-normal"
            />
            <div className="absolute bottom-3 right-3 text-xs text-slate-400 pointer-events-none bg-white/80 px-2 py-0.5 rounded">
              {studyMaterial.trim().split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {/* Error Message */}
          {genError && (
            <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p className="text-xs mt-0.5">{genError}</p>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="mt-5 flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 hidden sm:block">
              Generates exactly 3 multiple-choice questions strictly from the text.
            </p>
            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={isGenerating}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-sm transition ${
                isGenerating
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating 3 Questions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Quiz</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Section 2: Quiz Presentation Area */}
        {questions && (
          <section
            ref={quizRef}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6 scroll-mt-20"
          >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  2
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Practice Quiz
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select one option (A, B, C, or D) for each question
                  </p>
                </div>
              </div>

              {/* Progress counter */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 self-start sm:self-auto">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  {answeredCount} of 3 questions answered
                </span>
              </div>
            </div>

            {/* Prompt Instruction */}
            {submissionPrompt && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700 flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <span>{submissionPrompt}</span>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-6">
              {questions.map((q, idx) => {
                const questionNumber = q.id || idx + 1;
                const currentAnswer = selectedAnswers[questionNumber];
                const evalItem = evaluation?.results?.find((r) => r.questionId === questionNumber);

                return (
                  <div
                    key={questionNumber}
                    className={`rounded-xl border p-5 transition ${
                      evalItem
                        ? evalItem.isCorrect
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-rose-200 bg-rose-50/20'
                        : currentAnswer
                        ? 'border-indigo-200 bg-indigo-50/15'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs mt-0.5">
                          {questionNumber}
                        </span>
                        <h4 className="text-base font-semibold text-slate-900 leading-snug">
                          {q.question}
                        </h4>
                      </div>

                      {/* Evaluation badge if graded */}
                      {evalItem && (
                        <span
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            evalItem.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {evalItem.isCorrect ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> Incorrect
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Radio Options A, B, C, D */}
                    <div className="grid grid-cols-1 gap-2.5 mt-4">
                      {q.options.map((opt) => {
                        const isSelected = currentAnswer === opt.label;
                        const isGraded = Boolean(evaluation);
                        const isCorrectOption = evalItem?.correctOption === opt.label;
                        const isIncorrectChosen = isGraded && isSelected && !evalItem?.isCorrect;

                        let cardStyle = 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50';
                        let labelStyle = 'bg-slate-100 text-slate-700 border-slate-300';

                        if (!isGraded && isSelected) {
                          cardStyle = 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500';
                          labelStyle = 'bg-indigo-600 text-white border-indigo-600';
                        } else if (isGraded) {
                          if (isCorrectOption) {
                            cardStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium ring-1 ring-emerald-500';
                            labelStyle = 'bg-emerald-600 text-white border-emerald-600';
                          } else if (isIncorrectChosen) {
                            cardStyle = 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-400';
                            labelStyle = 'bg-rose-600 text-white border-rose-600';
                          } else {
                            cardStyle = 'border-slate-200 opacity-60 bg-white';
                            labelStyle = 'bg-slate-100 text-slate-500 border-slate-200';
                          }
                        }

                        return (
                          <label
                            key={opt.label}
                            onClick={() => handleSelectOption(questionNumber, opt.label)}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm transition cursor-pointer select-none ${cardStyle}`}
                          >
                            <input
                              type="radio"
                              name={`question-${questionNumber}`}
                              value={opt.label}
                              checked={isSelected}
                              disabled={Boolean(evaluation)}
                              onChange={() => handleSelectOption(questionNumber, opt.label)}
                              className="sr-only"
                            />
                            {/* Option letter pill */}
                            <span
                              className={`w-6 h-6 rounded-md border flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${labelStyle}`}
                            >
                              {opt.label}
                            </span>
                            <span className="flex-1 text-slate-800 leading-snug pt-0.5">
                              {opt.text}
                            </span>
                            {/* State indicator icons */}
                            {isGraded && isCorrectOption && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            )}
                            {isGraded && isIncorrectChosen && (
                              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Explanation if graded */}
                    {evalItem && (
                      <div className="mt-4 pt-3.5 border-t border-slate-200/60">
                        <div
                          className={`p-3.5 rounded-xl text-xs sm:text-sm ${
                            evalItem.isCorrect
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80'
                              : 'bg-amber-50 text-amber-900 border border-amber-200/80'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>
                              {evalItem.isCorrect
                                ? 'Correct Explanation'
                                : `Explanation (Correct Answer: Option ${evalItem.correctOption})`}
                            </span>
                          </div>
                          <p className="leading-relaxed font-normal">
                            {evalItem.explanation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submission Error Banner */}
            {evalError && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold">Incomplete Answers</p>
                  <p className="text-xs mt-0.5">{evalError}</p>
                </div>
              </div>
            )}

            {/* Bottom Actions for Quiz */}
            {!evaluation ? (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {answeredCount === 3
                    ? 'All questions answered. Ready for assessment!'
                    : `Please answer all 3 questions (${3 - answeredCount} remaining)`}
                </p>
                <button
                  type="button"
                  onClick={handleSubmitAnswers}
                  disabled={isEvaluating}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-bold text-sm text-white shadow-sm transition ${
                    isEvaluating
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                  }`}
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Grading Answers...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answers</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </section>
        )}

        {/* Section 3: Assessment & Results Area */}
        {evaluation && (
          <section
            ref={resultsRef}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6 scroll-mt-20"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                3
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Quiz Results & Assessment
                </h3>
                <p className="text-xs text-slate-500">
                  Graded based strictly on your supplied study material
                </p>
              </div>
            </div>

            {/* Score Banner Card */}
            <div
              className={`rounded-2xl p-6 border flex flex-col sm:flex-row items-center justify-between gap-6 ${
                evaluation.score === 3
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : evaluation.score >= 2
                  ? 'bg-blue-50/70 border-blue-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-xs ${
                    evaluation.score === 3
                      ? 'bg-emerald-600 text-white'
                      : evaluation.score >= 2
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">
                      Score: {evaluation.score} / {evaluation.total}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                      {Math.round((evaluation.score / evaluation.total) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 mt-1">
                    {evaluation.summaryFeedback}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleRetakeQuiz}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate New Quiz</span>
                </button>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
                Question-by-Question Assessment
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {evaluation.results.map((res) => {
                  const q = questions?.find((item) => item.id === res.questionId);
                  return (
                    <div
                      key={res.questionId}
                      className={`p-4 rounded-xl border text-sm transition ${
                        res.isCorrect
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              res.isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {res.questionId}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {q?.question || `Question ${res.questionId}`}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            res.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {res.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <p>
                          <span className="text-slate-500 font-medium">Your Answer:</span>{' '}
                          <span
                            className={`font-bold ${
                              res.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            Option {res.selectedOption}
                          </span>
                        </p>
                        {!res.isCorrect && (
                          <p>
                            <span className="text-slate-500 font-medium">Correct Answer:</span>{' '}
                            <span className="font-bold text-emerald-700">
                              Option {res.correctOption}
                            </span>
                          </p>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-slate-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                        <strong className="text-slate-700 font-semibold">Explanation:</strong>{' '}
                        {res.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>Interactive Quiz Generator • Practice assistant for university learners</p>
          <p className="text-slate-400">Strictly grounded in provided study material</p>
        </div>
      </footer>
    </div>
  );
}
