import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Generate Quiz from study material
app.post('/api/quiz/generate', async (req, res) => {
  try {
    const { studyMaterial } = req.body;

    if (!studyMaterial || typeof studyMaterial !== 'string' || studyMaterial.trim().length === 0) {
      return res.status(400).json({
        error: 'No study material supplied. Please provide course notes or study material before generating a quiz.',
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in AI Studio.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Here is the study material provided by the student:\n\n"""\n${studyMaterial.trim()}\n"""\n\nGenerate exactly three multiple-choice questions based strictly on this material.`
            }
          ]
        }
      ],
      config: {
        systemInstruction: `You are a practice quiz assistant for university students.

## Source Constraints
Base questions, correct answers, and explanations on the study material supplied by the user. If no material is supplied, ask for it before generating a quiz.

## Quiz Generation and Presentation
- Generate exactly three multiple-choice questions based strictly on the study material provided by the user.
- Number the questions 1 through 3, and provide four options labelled A, B, C, and D for each.
- Ensure that each question has exactly one correct option.
- Present only the questions and their multiple-choice options. Do NOT include an answer key, correct answer indicators, or explanations in this initial output.
- Ask the student to submit their answers using question numbers and option labels.
- Wait for the student to submit their answers before providing any feedback, assessment, or explanations.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            submissionPrompt: {
              type: Type.STRING,
              description: "Instructions asking the student to submit their answers using question numbers and option labels (e.g. 1: A, 2: B, 3: C)."
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER, description: "Question number 1, 2, or 3" },
                  question: { type: Type.STRING, description: "Question text based strictly on the study material" },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING, description: "Option letter: A, B, C, or D" },
                        text: { type: Type.STRING, description: "Option text" }
                      },
                      required: ["label", "text"]
                    }
                  }
                },
                required: ["id", "question", "options"]
              }
            }
          },
          required: ["submissionPrompt", "questions"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      return res.status(500).json({ error: 'Failed to receive a valid quiz response from AI.' });
    }

    const quizData = JSON.parse(outputText);
    return res.json(quizData);
  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({
      error: error?.message || 'An error occurred while generating the quiz. Please try again.',
    });
  }
});

// Endpoint: Evaluate submitted answers against study material and questions
app.post('/api/quiz/evaluate', async (req, res) => {
  try {
    const { studyMaterial, questions, answers } = req.body;

    if (!studyMaterial || typeof studyMaterial !== 'string' || studyMaterial.trim().length === 0) {
      return res.status(400).json({
        error: 'Study material is required to evaluate answers.',
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length !== 3) {
      return res.status(400).json({
        error: 'A set of 3 questions is required for evaluation.',
      });
    }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        error: 'Student answers are required.',
      });
    }

    // Check if any answers are missing or unclear
    const missing: number[] = [];
    for (const q of questions) {
      const ans = answers[q.id];
      if (!ans || !['A', 'B', 'C', 'D'].includes(String(ans).toUpperCase())) {
        missing.push(q.id);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        missingAnswers: true,
        missingQuestions: missing,
        error: `Please select an answer for Question ${missing.join(', ')} before submitting your answers for evaluation.`,
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in AI Studio.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Study Material:
"""
${studyMaterial.trim()}
"""

Questions and Options:
${JSON.stringify(questions, null, 2)}

Student's Submitted Answers:
${JSON.stringify(answers, null, 2)}

Please evaluate the student's submitted answers against the supplied study material according to the system instructions.`
            }
          ]
        }
      ],
      config: {
        systemInstruction: `You are a practice quiz assistant for university students.

## Source Constraints
Base questions, correct answers, and explanations on the study material supplied by the user.

## Assessment and Feedback
- Evaluate the student's submitted answers against the supplied study material.
- State the student's total score out of 3 and clearly list which questions were correct and which were incorrect.
- For any incorrect answer, state the correct option and provide a concise explanation based on the study material.
- If an answer is missing or unclear, ask the student for clarification before proceeding.
- Do not generate a new quiz unless explicitly requested by the student.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: "Total score out of 3 (number of correct answers, from 0 to 3)"
            },
            total: {
              type: Type.INTEGER,
              description: "Total number of questions (always 3)"
            },
            summaryFeedback: {
              type: Type.STRING,
              description: "Clear overall statement of the student's total score out of 3 and concise list of which questions were correct and which were incorrect."
            },
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.INTEGER, description: "Question number (1, 2, or 3)" },
                  isCorrect: { type: Type.BOOLEAN, description: "True if the student's answer was correct, false otherwise" },
                  selectedOption: { type: Type.STRING, description: "The option letter the student selected: A, B, C, or D" },
                  correctOption: { type: Type.STRING, description: "The correct option letter according to the study material: A, B, C, or D" },
                  explanation: {
                    type: Type.STRING,
                    description: "Concise explanation based strictly on the study material justifying why the correct option is right and/or why the chosen option is wrong."
                  }
                },
                required: ["questionId", "isCorrect", "selectedOption", "correctOption", "explanation"]
              }
            }
          },
          required: ["score", "total", "summaryFeedback", "results"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      return res.status(500).json({ error: 'Failed to receive a valid evaluation from AI.' });
    }

    const evalData = JSON.parse(outputText);
    return res.json(evalData);
  } catch (error: any) {
    console.error('Quiz evaluation error:', error);
    return res.status(500).json({
      error: error?.message || 'An error occurred while evaluating your answers. Please try again.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: port,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Interactive Quiz Generator running at http://localhost:${port}`);
  });
}

startServer();
