// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/topics.js
//
// ROUTE:
//   /api/topics?id=COURSE_ID&subjectid=SUBJECT_ID
//
// EXAMPLE:
//   /api/topics?id=8&subjectid=51
//
// TOKEN SOURCE:
//   /tokens.json
//
// FLOW:
//
//   /api/topics?id=8&subjectid=51
//          |
//          v
//   /tokens.json
//          |
//          v
//   Find matching batch_id = 8
//          |
//          v
//   Get matching userId + token SERVER-SIDE
//          |
//          v
//   Call:
//
//   https://sachinacademyapi.classx.co.in/get/
//   alltopicfrmlivecourseclass?courseid=8&subjectid=51&start=-1
//
// IMPORTANT:
//   - No hardcoded ClassX token
//   - No hardcoded user ID
//   - userId and token are never returned
//   - Credentials are used only for the upstream request
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

const TOPICS_API =
    "https://sachinacademyapi.classx.co.in/get/alltopicfrmlivecourseclass";


// ============================================================================
// RESPONSE HEADERS
// ============================================================================

const HEADERS = {

    "Access-Control-Allow-Origin":
        "*",

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
// JSON RESPONSE HELPER
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
            headers:
                HEADERS
        }

    );

}


// ============================================================================
// READ COURSE ID
// ============================================================================

function getCourseId(
    request
) {

    const url =
        new URL(
            request.url
        );


    const rawId =
        url.searchParams.get(
            "id"
        );


    if (
        rawId === null ||
        rawId === undefined
    ) {

        return "";

    }


    return String(
        rawId
    ).trim();

}


// ============================================================================
// READ SUBJECT ID
// ============================================================================

function getSubjectId(
    request
) {

    const url =
        new URL(
            request.url
        );


    const rawSubjectId =
        url.searchParams.get(
            "subjectid"
        );


    if (
        rawSubjectId === null ||
        rawSubjectId === undefined
    ) {

        return "";

    }


    return String(
        rawSubjectId
    ).trim();

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
                method:
                    "GET",

                headers: {

                    "Accept":
                        "application/json"

                },

                cache:
                    "no-store"

            }

        );


    if (
        !response.ok
    ) {

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
// Matches:
//
//   tokens.json -> data[].batch_id
//
// against:
//
//   ?id=
//
// Supported fields:
//
//   batch_id
//   batchId
//   id
//
// User ID:
//
//   userId
//   user_id
//
// Token:
//
//   token
//   authorization
//
// Credentials remain server-side.
// ============================================================================

function findMatchingBatch(
    tokenData,
    courseId
) {

    const wantedId =
        String(
            courseId
        ).trim();


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


        const rawUserId =
            item.userId ??
            item.user_id;


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
// BUILD TOPICS API URL
// ============================================================================

function buildTopicsUrl(
    courseId,
    subjectId
) {

    const url =
        new URL(
            TOPICS_API
        );


    url.searchParams.set(
        "courseid",
        courseId
    );


    url.searchParams.set(
        "subjectid",
        subjectId
    );


    url.searchParams.set(
        "start",
        "-1"
    );


    return url.toString();

}


// ============================================================================
// FETCH TOPICS
// ============================================================================

async function fetchTopics(
    courseId,
    subjectId,
    account
) {

    const topicsUrl =
        buildTopicsUrl(
            courseId,
            subjectId
        );


    const response =
        await fetch(

            topicsUrl,

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
            `Topics API returned HTTP ${response.status}`
        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "Topics API returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid Topics API response."
        );

    }


    return json;

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

        // =====================================================================
        // 1. READ PARAMETERS
        // =====================================================================

        const courseId =
            getCourseId(
                request
            );


        const subjectId =
            getSubjectId(
                request
            );


        // =====================================================================
        // 2. VALIDATE COURSE ID
        // =====================================================================

        if (
            !courseId
        ) {

            return jsonResponse(

                {

                    status:
                        400,

                    error:
                        "Missing course ID.",

                    message:
                        "Use /api/topics?id=COURSE_ID&subjectid=SUBJECT_ID",

                    data:
                        []

                },

                400

            );

        }


        // =====================================================================
        // 3. VALIDATE SUBJECT ID
        // =====================================================================

        if (
            !subjectId
        ) {

            return jsonResponse(

                {

                    status:
                        400,

                    error:
                        "Missing subject ID.",

                    message:
                        "Use /api/topics?id=COURSE_ID&subjectid=SUBJECT_ID",

                    courseId,

                    data:
                        []

                },

                400

            );

        }


        // =====================================================================
        // 4. FETCH TOKENS.JSON
        // =====================================================================

        const tokenResponse =
            await fetchTokens(
                context.request,
                context.env
            );


        // =====================================================================
        // 5. MATCH COURSE ID WITH batch_id
        // =====================================================================

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

                    status:
                        404,

                    error:
                        "No matching batch found in tokens.json.",

                    courseId,

                    subjectId,

                    data:
                        []

                },

                404

            );

        }


        // =====================================================================
        // 6. CALL TOPICS API
        // =====================================================================

        const upstream =
            await fetchTopics(

                courseId,

                subjectId,

                account

            );


        // =====================================================================
        // 7. RETURN CLEAN RESPONSE
        // =====================================================================
        //
        // userId and token are never returned.
        //
        // =====================================================================

        const response = {

            status:
                200,

            courseId,

            subjectId,

            data:
                Array.isArray(
                    upstream.data
                )
                    ? upstream.data
                    : (
                        upstream.data ??
                        []
                    )

        };


        return jsonResponse(
            response,
            200
        );


    } catch (
        error
    ) {

        return jsonResponse(

            {

                status:
                    500,

                error:
                    error?.message ||
                    "Internal Server Error.",

                data:
                    []

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

            status:
                204,

            headers:
                HEADERS

        }

    );

    }
