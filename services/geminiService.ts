import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Message, AgentResponse } from "../types";

// Schema definitions menggunakan object literal agar kompatibel dengan SDK resmi
export const fileTools = [
  {
    name: 'writeFile',
    description: 'Create or update a file. Explain why first.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: { type: SchemaType.STRING, description: 'File path.' },
        content: { type: SchemaType.STRING, description: 'Content to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'readFile',
    description: 'Read a file content.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { path: { type: SchemaType.STRING } },
      required: ['path'],
    },
  },
  {
    name: 'deleteFile',
    description: 'Delete a file or folder.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { path: { type: SchemaType.STRING } },
      required: ['path'],
    },
  },
  {
    name: 'listDirectory',
    description: 'List directory content for verification.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { path: { type: SchemaType.STRING } },
      required: ['path'],
    },
  }
];

export async function chatWithAgent(
  messages: Message[], 
  systemInstruction: string,
  onToolCall: (name: string, args: any) => Promise<any>,
  isConfirmed: boolean = false,
  overrideApiKey?: string,
  modelName: string = 'gemini-3-flash-preview',
  imageData?: { data: string; mimeType: string }
): Promise<AgentResponse> {
  
  // Ambil API Key (Prioritas dari parameter App.tsx)
  const apiKey = overrideApiKey;
  if (!apiKey) throw new Error("API Key tidak ditemukan! Masuk ke Settings.");

  // INISIALISASI SDK RESMI
  const genAI = new GoogleGenerativeAI(apiKey);
  const activeModel = ['gemini-3-flash-preview', 'gemini-2.5-flash'].includes(modelName) ? modelName : 'gemini-3-flash-preview';

  const model = genAI.getGenerativeModel({
    model: activeModel,
    systemInstruction: `IDENTITAS: Kamu adalah Senior Software Engineer. Nama kode kamu DS-AI AGENT CORE.
PERSONALITAS: Berbicaralah seperti rekan kerja manusia yang cerdas, solutif, dan profesional. Jangan kaku seperti chatbot.
LINGKUNGAN & BATASAN: 
1. Kamu bekerja secara eksklusif di dalam direktori 'root' proyek ini.
2. Kamu DILARANG KERAS mencoba mengakses atau mengedit file di luar jalur 'root/'.
3. Kamu memiliki akses NYATA ke file melalui tools. Jika kamu ragu tentang struktur folder, gunakan 'listDirectory' secara proaktif.
4. Kamu punya intuisi teknis: sebelum mengedit file, baca isinya dulu ('readFile') agar perubahanmu tidak merusak kode yang sudah ada.
5. JANGAN PERNAH membuat alasan bahwa kamu tidak punya sistem file.

${systemInstruction}`,
    tools: [{ functionDeclarations: fileTools as any }],
  });

  // Konfigurasi Thinking/Thoughts untuk Gemini 3
  const generationConfig: any = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
  };

  if (activeModel.includes('gemini-3')) {
    generationConfig.thinkingConfig = { includeThoughts: true };
  }

  // Format history chat
  const contents = messages.slice(-15).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
  }));

  // Handle Image jika ada
  if (imageData && contents.length > 0) {
    const lastMsg = contents[contents.length - 1];
    if (lastMsg.role === 'user') {
      lastMsg.parts.push({ 
        inlineData: { data: imageData.data, mimeType: imageData.mimeType } 
      });
    }
  }

  try {
    const result = await model.generateContent({ contents, generationConfig });
    const response = result.response;
    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("AI tidak merespon.");

    const text = response.text() || "";
    // Mengambil thought secara manual dari objek candidate jika tersedia
    const thought = (candidate as any).thought || ""; 
    const functionCalls = candidate.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      if (!isConfirmed) {
        return { 
          text: text || "Saya perlu melakukan tindakan teknis:", 
          thought, 
          pendingActions: functionCalls as any, 
          needsConfirmation: true 
        };
      }

      // Eksekusi Tools
      const toolResults = [];
      for (const fc of functionCalls) {
        if (!fc) continue;
        const resData = await onToolCall(fc.name, fc.args);
        toolResults.push({ 
          functionResponse: { name: fc.name, response: { result: resData } } 
        });
      }

      // Kirim balik hasil tool ke AI untuk final response
      const nextResult = await model.generateContent({
        contents: [
          ...contents,
          { role: 'model', parts: candidate.content?.parts || [] },
          { role: 'user', parts: toolResults as any }
        ],
        generationConfig
      });

      return {
        text: nextResult.response.text() || "Selesai.",
        thought: (nextResult.response.candidates?.[0] as any)?.thought || "",
        needsConfirmation: false
      };
    }

    return { text, thought, needsConfirmation: false };

  } catch (error: any) {
    console.error(`Gagal pada ${activeModel}:`, error);
    throw new Error(error.message || "Terjadi kesalahan pada AI Service.");
  }
}

export async function testGeminiConnection(apiKey: string, modelName: string = 'gemini-3-flash-preview') {
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent("Ping!");
    return { success: true, message: `Koneksi ${modelName} Aktif!` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}