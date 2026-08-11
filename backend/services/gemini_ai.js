export default async function getembedding(text) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "models/text-embedding-004",
                    content: {
                        parts: [{ text }]
                    }
                })
            }
        );
        const data = await res.json();
        return data?.embedding?.values || [];
    } catch (err) {
        console.log("Embedding error:", err);
        return [];
    }
}