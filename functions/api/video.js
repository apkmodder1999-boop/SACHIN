// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/video.js
//
// ROUTE:
//   /api/video?id=COURSE_ID&videoid=VIDEO_ID
//
// EXAMPLE:
//   /api/video?id=8&videoid=756
//
// TOKEN SOURCE:
//   /tokens.json
//
// FLOW:
//
//   /api/video
//        |
//        v
//   tokens.json
//        |
//        v
//   Match batch ID with ?id=
//        |
//        v
//   Get matching userId + token
//        |
//        v
//   Call ClassX Video API
//        |
//        v
//   Decrypt encrypted values
//        |
//        v
//   Return decoded response
//
// SECURITY:
//   - Token is never returned
//   - User ID is never returned
//   - Credentials are used only for upstream request
// ============================================================================


// ============================================================================
// SETTINGS
// ============================================================================

function resolveTokenUrl(request, env) {
    if (env && env.TOKENS_URL) {
        return env.TOKENS_URL;
    }
    if (request && request.url) {
        return new URL("/tokens.json", request.url).href;
    }
    return "/tokens.json";
}

const VIDEO_API =
    "https://sachinacademyapi.classx.co.in/get/fetchVideoDetailsById";

// AES key supplied by you
const DECRYPTION_KEY =
    "638udh3829162018";


// ============================================================================
// RESPONSE HEADERS
// ============================================================================

const HEADERS = {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
        "GET, OPTIONS",

    "Access-Control-Allow-Headers":
        "*",

    "Content-Type":
        "application/json; charset=UTF-8",

    "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",

    "Pragma":
        "no-cache"
};


// ============================================================================
// JSON RESPONSE
// ============================================================================

function jsonResponse(
    payload,
    status = 200
) {
    return new Response(
        JSON.stringify(
            payload,
            null,
            4
        ),
        {
            status,
            headers: HEADERS
        }
    );
}


// ============================================================================
// QUERY PARAMETER HELPER
// ============================================================================

function getParam(
    request,
    name,
    defaultValue = ""
) {
    const url =
        new URL(request.url);

    const value =
        url.searchParams.get(name);

    if (
        value === null ||
        value === undefined
    ) {
        return defaultValue;
    }

    return String(value).trim();
}


// ============================================================================
// GET COURSE ID
// ============================================================================

function getCourseId(request) {
    return getParam(
        request,
        "id"
    );
}


// ============================================================================
// GET VIDEO ID
// ============================================================================

function getVideoId(request) {
    return getParam(
        request,
        "videoid"
    );
}


// ============================================================================
// GET YT FLAG
// ============================================================================

function getYtFlag(request) {
    return getParam(
        request,
        "ytflag",
        "0"
    );
}


// ============================================================================
// FETCH TOKENS.JSON
// ============================================================================

async function fetchTokens(request, env) {

    const tokenUrl = resolveTokenUrl(request, env);

    const response =
        await fetch(
            tokenUrl,
            {
                method: "GET",

                headers: {
                    "Accept":
                        "application/json"
                },

                cache:
                    "no-store"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Token source returned HTTP ${response.status}`
        );
    }

    let json;

    try {
        json =
            await response.json();
    } catch {
        throw new Error(
            "tokens.json returned invalid JSON."
        );
    }

    if (
        !json ||
        typeof json !== "object"
    ) {
        throw new Error(
            "Invalid tokens.json response."
        );
    }

    if (
        !Array.isArray(
            json.data
        )
    ) {
        throw new Error(
            "tokens.json does not contain data[]."
        );
    }

    return json;
}


// ============================================================================
// FIND MATCHING BATCH
// ============================================================================
//
// Supports:
//
//   batch_id
//   id
//
// User credentials:
//
//   userId
//   user_id
//
// Token:
//
//   token
//   authorization
// ============================================================================

function findMatchingBatch(
    tokenData,
    courseId
) {

    const wantedId =
        String(courseId).trim();

    for (
        const item
        of tokenData
    ) {

        if (
            !item ||
            typeof item !== "object"
        ) {
            continue;
        }

        const rawBatchId =
            item.batch_id ??
            item.batchId ??
            item.id;

        if (
            rawBatchId === undefined ||
            rawBatchId === null
        ) {
            continue;
        }

        const batchId =
            String(
                rawBatchId
            ).trim();

        if (
            batchId !== wantedId
        ) {
            continue;
        }


        // ------------------------------------------------------------
        // USER ID
        // ------------------------------------------------------------

        const rawUserId =
            item.userId ??
            item.user_id;


        // ------------------------------------------------------------
        // TOKEN
        // ------------------------------------------------------------

        const rawToken =
            item.token ??
            item.authorization;


        if (
            rawUserId === undefined ||
            rawUserId === null ||
            rawToken === undefined ||
            rawToken === null
        ) {
            return null;
        }


        const userId =
            String(
                rawUserId
            ).trim();

        const token =
            String(
                rawToken
            ).trim();


        if (
            !userId ||
            !token
        ) {
            return null;
        }


        return {
            userId,
            token,
            batchId
        };
    }


    return null;
}


// ============================================================================
// BUILD VIDEO API URL
// ============================================================================

function buildVideoUrl(
    courseId,
    videoId,
    ytFlag
) {

    const url =
        new URL(
            VIDEO_API
        );


    url.searchParams.set(
        "course_id",
        courseId
    );


    url.searchParams.set(
        "video_id",
        videoId
    );


    url.searchParams.set(
        "ytflag",
        ytFlag
    );


    url.searchParams.set(
        "folder_wise_course",
        "0"
    );


    url.searchParams.set(
        "lc_app_api_url",
        ""
    );


    return url.toString();
}


// ============================================================================
// FETCH VIDEO DETAILS
// ============================================================================

async function fetchVideoDetails(
    courseId,
    videoId,
    ytFlag,
    account
) {

    const videoUrl =
        buildVideoUrl(
            courseId,
            videoId,
            ytFlag
        );


    const response =
        await fetch(
            videoUrl,
            {
                method:
                    "GET",

                headers: {

                    "Accept":
                        "*/*",

                    "Auth-Key":
                        "appxapi",

                    "Authorization":
                        account.token,

                    "Client-Service":
                        "Appx",

                    "Device-Type":
                        "",

                    "Is-Safari":
                        "0",

                    "Source":
                        "website",

                    "User-Id":
                        account.userId
                },

                cache:
                    "no-store"
            }
        );


    if (
        !response.ok
    ) {
        throw new Error(
            `Video API returned HTTP ${response.status}`
        );
    }


    let json;

    try {
        json =
            await response.json();
    } catch {
        throw new Error(
            "Video API returned invalid JSON."
        );
    }


    if (
        !json ||
        typeof json !== "object"
    ) {
        throw new Error(
            "Invalid Video API response."
        );
    }


    return json;
}


// ============================================================================
// BASE64 -> UINT8ARRAY
// ============================================================================

function base64ToUint8Array(
    base64
) {

    try {

        if (
            typeof base64 !==
            "string"
        ) {
            return null;
        }


        let normalized =
            base64
                .replace(
                    /-/g,
                    "+"
                )
                .replace(
                    /_/g,
                    "/"
                );


        while (
            normalized.length % 4 !==
            0
        ) {
            normalized += "=";
        }


        const binary =
            atob(
                normalized
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {
            bytes[i] =
                binary.charCodeAt(i);
        }


        return bytes;

    } catch {

        return null;

    }
}


// ============================================================================
// AES DECRYPTION
// ============================================================================
//
// Same logic as the CryptoJS code:
//
// AES
// CBC
// PKCS7
//
// Input format:
//
// cipherBase64:ivBase64
// ============================================================================

async function decrypt(
    enc
) {

    try {

        if (
            typeof enc !==
            "string"
        ) {
            return null;
        }


        const parts =
            enc.split(":");


        if (
            parts.length !== 2
        ) {
            return null;
        }


        const cipher =
            parts[0];

        const iv =
            parts[1];


        if (
            !cipher ||
            !iv
        ) {
            return null;
        }


        const cipherBytes =
            base64ToUint8Array(
                cipher
            );

        const ivBytes =
            base64ToUint8Array(
                iv
            );


        if (
            !cipherBytes ||
            !ivBytes
        ) {
            return null;
        }


        // AES-CBC requires 16-byte IV
        if (
            ivBytes.length !== 16
        ) {
            return null;
        }


        const keyBytes =
            new TextEncoder()
                .encode(
                    DECRYPTION_KEY
                );


        // 638udh3829162018 = 16 bytes
        if (
            keyBytes.length !== 16
        ) {
            return null;
        }


        const cryptoKey =
            await crypto.subtle.importKey(
                "raw",

                keyBytes,

                {
                    name:
                        "AES-CBC"
                },

                false,

                [
                    "decrypt"
                ]
            );


        const decrypted =
            await crypto.subtle.decrypt(
                {
                    name:
                        "AES-CBC",

                    iv:
                        ivBytes
                },

                cryptoKey,

                cipherBytes
            );


        return new TextDecoder(
            "utf-8",
            {
                fatal: true
            }
        ).decode(
            decrypted
        );

    } catch {

        return null;

    }
}


// ============================================================================
// CHECK ENCRYPTED FORMAT
// ============================================================================

function isEncryptedString(
    value
) {

    if (
        typeof value !==
        "string"
    ) {
        return false;
    }


    const parts =
        value.split(":");


    if (
        parts.length !== 2
    ) {
        return false;
    }


    const cipher =
        parts[0];

    const iv =
        parts[1];


    if (
        !cipher ||
        !iv
    ) {
        return false;
    }


    const ivBytes =
        base64ToUint8Array(
            iv
        );


    if (
        !ivBytes ||
        ivBytes.length !== 16
    ) {
        return false;
    }


    return true;
}


// ============================================================================
// RECURSIVE DECRYPTION
// ============================================================================
//
// Automatically processes:
//
// data.file_link
// data.download_link
// data.livestream_links[].path
// data.encrypted_links[].path
// data.encrypted_links[].backup_url
// data.encrypted_links[].backup_url2
// data.download_links[].path
// data.pdf_encryption_key
// etc.
//
// Normal strings remain unchanged.
// ============================================================================

async function decryptObject(
    value
) {

    // ------------------------------------------------------------
    // STRING
    // ------------------------------------------------------------

    if (
        typeof value ===
        "string"
    ) {

        if (
            !isEncryptedString(
                value
            )
        ) {
            return value;
        }


        const decrypted =
            await decrypt(
                value
            );


        if (
            decrypted === null
        ) {
            return value;
        }


        return decrypted;
    }


    // ------------------------------------------------------------
    // ARRAY
    // ------------------------------------------------------------

    if (
        Array.isArray(
            value
        )
    ) {

        const output = [];


        for (
            const item
            of value
        ) {

            output.push(
                await decryptObject(
                    item
                )
            );
        }


        return output;
    }


    // ------------------------------------------------------------
    // OBJECT
    // ------------------------------------------------------------

    if (
        value !== null &&
        typeof value ===
            "object"
    ) {

        const output = {};


        for (
            const [
                key,
                item
            ]
            of Object.entries(
                value
            )
        ) {

            output[key] =
                await decryptObject(
                    item
                );
        }


        return output;
    }


    // ------------------------------------------------------------
    // OTHER VALUES
    // ------------------------------------------------------------

    return value;
}


// ============================================================================
// MAIN GET HANDLER
// ============================================================================

export async function onRequestGet(
    context
) {

    const request =
        context.request;


    try {

        // ============================================================
        // 1. PARAMETERS
        // ============================================================

        const courseId =
            getCourseId(
                request
            );

        const videoId =
            getVideoId(
                request
            );

        const ytFlag =
            getYtFlag(
                request
            );


        // ============================================================
        // 2. VALIDATE COURSE ID
        // ============================================================

        if (
            !courseId
        ) {

            return jsonResponse(
                {
                    status: 400,

                    error:
                        "Missing course ID.",

                    message:
                        "Use /api/video?id=COURSE_ID&videoid=VIDEO_ID",

                    data: []
                },

                400
            );
        }


        // ============================================================
        // 3. VALIDATE VIDEO ID
        // ============================================================

        if (
            !videoId
        ) {

            return jsonResponse(
                {
                    status: 400,

                    error:
                        "Missing video ID.",

                    message:
                        "Use /api/video?id=COURSE_ID&videoid=VIDEO_ID",

                    courseId,

                    data: []
                },

                400
            );
        }


        // ============================================================
        // 4. FETCH MANUALLY MAINTAINED TOKEN DATA
        // ============================================================

        const tokenResponse =
            await fetchTokens(
                context.request,
                context.env
            );


        // ============================================================
        // 5. MATCH COURSE/BATCH
        // ============================================================

        const account =
            findMatchingBatch(
                tokenResponse.data,
                courseId
            );


        if (
            !account
        ) {

            return jsonResponse(
                {
                    status: 404,

                    error:
                        "No matching batch found in tokens.json.",

                    courseId,

                    videoId,

                    data: []
                },

                404
            );
        }


        // ============================================================
        // 6. CALL VIDEO API
        // ============================================================

        const upstream =
            await fetchVideoDetails(
                courseId,
                videoId,
                ytFlag,
                account
            );


        // ============================================================
        // 7. DECRYPT RESPONSE
        // ============================================================

        const decoded =
            await decryptObject(
                upstream
            );


        // ============================================================
        // 8. RETURN DECODED RESPONSE
        // ============================================================

        return jsonResponse(
            {
                status: 200,

                courseId,

                videoId,

                ytflag:
                    ytFlag,

                data:
                    Array.isArray(
                        decoded.data
                    )
                        ? decoded.data
                        : (
                            decoded.data ??
                            []
                        )
            },

            200
        );


    } catch (
        error
    ) {

        // ============================================================
        // ERROR
        // ============================================================

        return jsonResponse(
            {
                status: 500,

                error:
                    error?.message ||
                    "Internal Server Error.",

                data: []
            },

            500
        );
    }
}


// ============================================================================
// OPTIONS
// ============================================================================

export async function onRequestOptions() {

    return new Response(
        null,

        {
            status: 204,

            headers:
                HEADERS
        }
    );
    }
