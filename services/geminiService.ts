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

/**
 * OTAK UTAMA CHAT - MULTI MODEL & VISION SUPPORT
 */
export async function chatWithAgent(
  messages: Message[], 
  systemInstruction: string,
  onToolCall: (name: string, args: any) => Promise<any>,
  isConfirmed: boolean = false,
  overrideApiKey?: string,
  modelName: string = 'gemini-3-flash-preview', // DEFAULT MODEL
  imageData?: { data: string; mimeType: string } // UNTUK ANALISIS FOTO
): Promise<AgentResponse> {
  
  const apiKey = overrideApiKey || localStorage.getItem('DS_AI_API_KEY');
  
  if (!apiKey) {
    throw new Error("API Key tidak ditemukan! Masukkan di Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Hanya aktifkan thinkingConfig jika menggunakan model gemini-3
  const config: any = {
    systemInstruction: systemInstruction + "\n\nSelalu jelaskan sebelum memanggil tool.",
    tools: [{ functionDeclarations: fileTools }],
  };

  if (modelName.includes('gemini-3')) {
    config.thinkingConfig = { thinkingLevel: 'HIGH' };
  }

  // --- OPTIMASI KONTEKS ---
  const contextWindow = messages.slice(-10);

  const contents = contextWindow.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
  }));

  // INPUT GAMBAR (Jika ada foto di pesan terakhir)
  if (imageData && contents.length > 0) {
    const lastMsg = contents[contents.length - 1];
    if (lastMsg.role === 'user') {
      lastMsg.parts.push({
        inlineData: {
          data: imageData.data,
          mimeType: imageData.mimeType
        }
      });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName, // MENGGUNAKAN MODEL DINAMIS (3.0 atau 2.5)
      contents,
      config,
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("AI tidak memberikan respon.");

    const text = candidate.content?.parts?.find(p => p.text)?.text || "";
    const thought = (candidate as any)?.thought || ""; 
    
    const functionCalls = candidate.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      if (!isConfirmed) {
        return {
          text: text || "Saya punya rencana modifikasi file:",
          thought: thought,
          pendingActions: functionCalls as any,
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
        model: modelName,
        contents: [
          ...contents,
          { role: 'model', parts: candidate.content?.parts || [] },
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
      text: text,
      thought: thought,
      needsConfirmation: false
    };

  } catch (error: any) {
    console.error(`Error on ${modelName}:`, error);
    throw new Error(error.message);
  }
}

/**
 * FUNGSI TES KONEKSI (Mendukung tes model spesifik)
 */
export async function testGeminiConnection(apiKey: string, modelName: string = 'gemini-3-flash-preview') {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: 'Ping!' }] }],
    });
    return { success: true, message: `Berhasil (${modelName})!` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
