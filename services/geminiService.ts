import { GoogleGenAI, Type } from "@google/genai";
import { Message, AgentResponse } from "../types";

export const fileTools = [
  {
    name: 'writeFile',
    description: 'Create or update a file. Explain why first.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'File path.' },
        content: { type: Type.STRING, description: 'Content to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'readFile',
    description: 'Read a file content.',
    parameters: {
      type: Type.OBJECT,
      properties: { path: { type: Type.STRING } },
      required: ['path'],
    },
  },
  {
    name: 'deleteFile',
    description: 'Delete a file or folder.',
    parameters: {
      type: Type.OBJECT,
      properties: { path: { type: Type.STRING } },
      required: ['path'],
    },
  }
];

const MODEL_NAME = 'gemini-3-flash-preview';

const getApiKey = () => {
  const key = localStorage.getItem('DS_AI_API_KEY');
  if (!key) throw new Error("API Key tidak ditemukan! Masukkan di Settings.");
  return key;
};

/**
 * OTAK UTAMA CHAT
 */
export async function chatWithAgent(
  messages: Message[], 
  systemInstruction: string,
  onToolCall: (name: string, args: any) => Promise<any>,
  isConfirmed: boolean = false
): Promise<AgentResponse> {
  
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const config = {
    systemInstruction: systemInstruction + "\n\nSelalu jelaskan sebelum memanggil tool.",
    thinkingConfig: {
      thinkingLevel: 'HIGH',
    },
    tools: [{ functionDeclarations: fileTools }],
  };

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
  }));

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config,
    });

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.find(p => p.text)?.text || "";
    // EKSTRAKSI THOUGHT UNTUK UI
    const thought = (candidate as any)?.thought || ""; 
    
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      if (!isConfirmed) {
        return {
          text: text || "Saya punya rencana modifikasi file:",
          thought: thought, // Kirim ke App.tsx
          pendingActions: functionCalls,
          needsConfirmation: true
        };
      }

      const results = [];
      for (const fc of functionCalls) {
        if (!fc) continue;
        const result = await onToolCall(fc.name, fc.args);
        results.push({
          functionResponse: {
            name: fc.name,
            response: { result },
          }
        });
      }

      const nextResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          ...contents,
          { role: 'model', parts: candidate?.content?.parts || [] },
          { role: 'user', parts: results as any }
        ],
        config
      });

      return {
        text: nextResponse.text || "Tugas selesai.",
        thought: (nextResponse.candidates?.[0] as any)?.thought || "",
        needsConfirmation: false
      };
    }

    return {
      text: response.text || "",
      thought: thought, // Kirim ke App.tsx
      needsConfirmation: false
    };

  } catch (error: any) {
    console.error("Gemini 3 Error:", error);
    throw new Error(`[DS-AI Error] ${error.message}`);
  }
}

/**
 * FUNGSI TES KONEKSI (DIBERSIHKAN DARI SAMPAH LOGIKA CHAT)
 */
export async function testGeminiConnection(apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Verifikasi model tersedia
    await ai.models.get({ model: MODEL_NAME }); 

    // 2. Test respon ringan
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: 'Ping!' }] }],
    });

    return { 
      success: true, 
      message: `Koneksi Berhasil! Respon: ${result.text?.trim()}` 
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message 
    };
  }
}