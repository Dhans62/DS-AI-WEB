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
  },
  {
    name: 'listDirectory',
    description: 'List directory content for verification.',
    parameters: {
      type: Type.OBJECT,
      properties: { path: { type: Type.STRING } },
      required: ['path'],
    },
  }
];

/**
 * OTAK UTAMA CHAT - MODEL: Gemini 3.0 Flash Preview & 2.5 Flash
 */
export async function chatWithAgent(
  messages: Message[], 
  systemInstruction: string,
  onToolCall: (name: string, args: any) => Promise<any>,
  isConfirmed: boolean = false,
  overrideApiKey?: string,
  modelName: string = 'gemini-3-flash-preview', // Default sesuai permintaan
  imageData?: { data: string; mimeType: string }
): Promise<AgentResponse> {
  
  const apiKey = overrideApiKey || localStorage.getItem('DS_AI_API_KEY');
  
  if (!apiKey) {
    throw new Error("API Key tidak ditemukan! Masukkan di Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Validasi Model Wajib
  const allowedModels = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
  const activeModel = allowedModels.includes(modelName) ? modelName : 'gemini-3-flash-preview';

  const modelParams: any = {
    model: activeModel,
    systemInstruction: systemInstruction + "\n\nSelalu jelaskan alasanmu sebelum memanggil tool.",
    tools: [{ functionDeclarations: fileTools }],
  };

  // Thinking config khusus model 3.0 untuk kedalaman analisa
  if (activeModel.includes('gemini-3')) {
    modelParams.thinkingConfig = { thinkingLevel: 'HIGH' };
  }

  const contextWindow = messages.slice(-15);

  const contents = contextWindow.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
  }));

  // Masukkan data gambar jika ada (Vision Support)
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
      ...modelParams,
      contents,
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("AI tidak memberikan respon.");

    const text = candidate.content?.parts?.find(p => p.text)?.text || "";
    const thought = (candidate as any).thought || ""; 
    
    const functionCalls = candidate.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

    // LOGIKA TOOL CALLING
    if (functionCalls && functionCalls.length > 0) {
      if (!isConfirmed) {
        return {
          text: text || "Saya telah menyiapkan rencana eksekusi file:",
          thought: thought,
          pendingActions: functionCalls as any,
          needsConfirmation: true
        };
      }

      // Eksekusi tool satu per satu
      const toolResults = [];
      for (const fc of functionCalls) {
        if (!fc) continue;
        const result = await onToolCall(fc.name, fc.args);
        toolResults.push({
          functionResponse: {
            name: fc.name,
            response: { result },
          }
        });
      }

      // Kirim balik ke model 3.0/2.5 sebagai "user" role dengan functionResponse
      const nextResponse = await ai.models.generateContent({
        ...modelParams,
        contents: [
          ...contents,
          { role: 'model', parts: candidate.content?.parts || [] },
          { role: 'user', parts: toolResults as any }
        ],
      });

      return {
        text: nextResponse.text || "Proses selesai.",
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
    console.error(`Error on ${activeModel}:`, error);
    throw new Error(error.message);
  }
}

export async function testGeminiConnection(apiKey: string, modelName: string = 'gemini-3-flash-preview') {
  const ai = new GoogleGenAI({ apiKey });
  try {
    await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: 'Connection Test' }] }],
    });
    return { success: true, message: `Koneksi ${modelName} Aktif!` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}