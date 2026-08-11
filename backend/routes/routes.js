import express from 'express';
const router = express.Router();
import multer from 'multer';


import getembedding from '../services/gemini_ai.js';
import generateAnswer from './groq_ai.js';
import authMiddleware from '../middleware/auth.js';
import prisma from '../db.js';
import cleanup from '../clean.js';



function chunkText(text) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const totalWords = words.length;
    const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);

    let maxWords;
    let overlap;
    if (totalWords < 100) {
        maxWords = 20;
        overlap = 5;
    } else if (totalWords < 200) {
        maxWords = 100;
        overlap = 20;
    } else if (totalWords < 1000) {
        maxWords = 150;
        overlap = 30;
    } else {
        maxWords = 250;
        overlap = 50;
    }

    const chunks = [];
    for (const para of paragraphs) {
        const paraWords = para.split(/\s+/);
        if (paraWords.length <= maxWords) {
            chunks.push(para);
        } else {
            for (let i = 0; i < paraWords.length; i += (maxWords - overlap)) {
                const chunkWords = paraWords.slice(i, i + maxWords);
                chunks.push(chunkWords.join(" "));
            }
        }
    }
    return chunks;
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotproduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotproduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotproduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function keywordScore(query, text) {
    let queryWords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
        if (word && textLower.includes(word)) {
            score += 0.05;
        }
    }
    return score;
}

router.get('/notes', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const notes = await prisma.note.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        });
        res.json(notes);
    } catch (err) {
        console.log("Fetch notes error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/write', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "No text provided" });
        }
        const userId = req.userId;
        const note = await prisma.note.create({
            data: { content: text, userId }
        });

        const chunks = chunkText(text);
        let chunksCreated = 0;

        for (const chunk of chunks) {
            try {
                const embedding = await getembedding(chunk);
                if (embedding && embedding.length > 0) {
                    await prisma.chunk.create({
                        data: {
                            text: chunk,
                            embedding: JSON.stringify(embedding),
                            noteId: note.id
                        }
                    });
                    chunksCreated++;
                }
            } catch (chunkErr) {
                console.log("Error creating chunk:", chunkErr);
            }
        }

        res.json({
            msg: "NOTE added successfully",
            success: true,
            chunksCreated,
            noteId: note.id
        });
    } catch (err) {
        console.log("Note adding error:", err);
        res.status(500).json({ error: "Failed to save note", message: err.message });
    }
});

router.post('/query', authMiddleware, async (req, res) => {
    const { text } = req.body;
    try {
        if (!text) {
            return res.status(400).json({ error: "No search query provided" });
        }
        const queryembedding = await getembedding(text);
        const userId = req.userId;

        const chunks = await prisma.chunk.findMany({
            where: { note: { userId } },
            include: { note: true }
        });

        if (chunks.length === 0) {
            return res.json({
                answer: "No notes found. Please add some notes or upload a PDF first.",
                sources: [],
                success: true
            });
        }

        const parsed = chunks.map(c => ({
            ...c,
            embedding: c.embedding ? JSON.parse(c.embedding) : []
        }));

        const results = parsed.map(item => {
            const similarity = cosineSimilarity(queryembedding, item.embedding);
            const boost = keywordScore(text, item.text);
            return {
                id: item.id,
                text: item.text,
                similarity: similarity + boost,
                boost
            };
        });

        let min = 0.5;
        let finalResults = [];
        while (finalResults.length === 0 && min > 0) {
            finalResults = results
                .filter(r => r.similarity > min)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 5);
            min -= 0.05;
        }

        const uniqueResults = [];
        const seen = new Set();
        for (const r of finalResults) {
            if (!seen.has(r.text)) {
                seen.add(r.text);
                uniqueResults.push(r);
            }
        }

        const dbHistory = await prisma.chat.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 6
        });
        const chatHistory = dbHistory.reverse();

        const answer = await generateAnswer(text, uniqueResults, chatHistory);

        await prisma.chat.create({ data: { role: "user", content: text, userId } });
        await prisma.chat.create({ data: { role: "assistant", content: answer, userId } });

        res.json({
            answer,
            sources: uniqueResults,
            success: true
        });
    } catch (err) {
        console.log("Query error:", err);
        res.status(500).json({
            error: "Failed to process query",
            message: err.message,
            answer: "Sorry, I encountered an error processing your query. Please try again."
        });
    }
});

// 1. Pure, native ES Module import - no 'createRequire' needed!
// import { extractText } from 'unpdf';
const upload = multer({ storage: multer.memoryStorage() });

import { extractText, getDocumentProxy } from 'unpdf';

async function extractTextFromPDF(buffer) {
    try {
        const pdfData = new Uint8Array(buffer);
        
        // 1. Initialize the document proxy first
        const pdf = await getDocumentProxy(pdfData);
        
        // 2. Explicitly tell unpdf to merge all pages into one string
        const { text } = await extractText(pdf, { mergePages: true });
        
        // 3. Bulletproof check: If it still returns an array, join it manually
        const finalString = Array.isArray(text) ? text.join('\n') : (text || '');
        
        return finalString.trim() || 'PDF extracted but no text found';
    } catch (err) {
        console.log('PDF extraction error:', err);
        return 'Error: Could not extract text from PDF';
    }
}
router.post('/upload-pdf', authMiddleware, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: "Only PDF files are allowed" });
        }
        const userId = req.userId;

        const fullText = await extractTextFromPDF(req.file.buffer);
        if (fullText.startsWith("Error:")) {
            return res.status(400).json({ error: fullText });
        }

        const note = await prisma.note.create({
            data: {
                content: `[PDF] ${req.file.originalname}\n\n${fullText}`,
                userId
            }
        });

        const chunks = chunkText(fullText);
        let chunksCreated = 0;

        for (const chunk of chunks) {
            try {
                const embedding = await getembedding(chunk);
                if (embedding && embedding.length > 0) {
                    await prisma.chunk.create({
                        data: {
                            text: chunk,
                            embedding: JSON.stringify(embedding),
                            noteId: note.id
                        }
                    });
                    chunksCreated++;
                }
            } catch (chunkErr) {
                console.log("Chunk creation error:", chunkErr);
            }
        }

        res.json({
            msg: "PDF uploaded and processed successfully",
            fileName: req.file.originalname,
            textLength: fullText.length,
            chunksCreated
        });
    } catch (err) {
        console.log("PDF upload error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/reset', (req, res) => {
    cleanup();
    res.json({ msg: "Reset completed" });
});

export default router;