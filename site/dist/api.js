import { CONFIG } from "./config.js";
const PROMPT = "The top part of this image shows a real person (cut off at the bottom), the rest of the canvas is empty white. " +
    "Complete the image by drawing ONLY the missing lower body: continue the visible clothing naturally down to a full " +
    "standing body with legs and shoes, facing the camera, natural proportions that match the visible upper body. " +
    "Match the exact clothing style, colours, skin tone, lighting and photo quality. " +
    "Do NOT change, redraw, move or resize anything that is already visible, especially the face, hair and head. " +
    "Keep the same position and scale, keep the background pure white, add no other people, text or objects.";
/** Sends the half-body image straight to Gemini; returns the generated full-body image. */
export async function requestBody(imageBase64, mimeType) {
    if (!CONFIG.geminiApiKey || CONFIG.geminiApiKey === "PASTE_GEMINI_KEY_HERE") {
        throw new Error("Gemini key is not set.");
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": CONFIG.geminiApiKey },
        body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: imageBase64 } }] }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                imageConfig: { aspectRatio: "9:16" },
            },
        }),
    });
    let data;
    try {
        data = (await res.json());
    }
    catch {
        throw new Error("Invalid response from Gemini.");
    }
    if (!res.ok)
        throw new Error(data.error?.message ?? `Body generation failed (${res.status}).`);
    for (const p of data.candidates?.[0]?.content?.parts ?? []) {
        const out = p.inlineData?.data ?? p.inline_data?.data;
        if (out) {
            const type = p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? "image/png";
            return await (await fetch(`data:${type};base64,${out}`)).blob();
        }
    }
    throw new Error("No image returned.");
}
