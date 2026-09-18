// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/subjects.js
//
// ROUTE:
//   /api/subjects?id=COURSE_ID
//
// EXAMPLE:
//   /api/subjects?id=8
//
// TOKEN SOURCE:
//   /tokens.json
//
// FLOW:
//
//   /api/subjects?id=8
//          |
//          v
//   /tokens.json
//          |
//          v
//   Find matching batch_id = 8
//          |
//          v
//   Read userId + token SERVER-SIDE
//          |
//          v
//   Call:
//
//   https://sachinacademyapi.classx.co.in/
//   get/allsubjectfrmlivecourseclass?courseid=8&start=-1
//
// IMPORTANT:
//   - No hardcoded ClassX token
//   - No hardcoded user ID
//   - Token and user ID are never returned
//   - Token and user ID are used only server-side
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

const SUBJECT_API =
    "https://sachinacademyapi.classx.co.in/get/allsubjectfrmlivecourseclass";


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
            headers:
                HEADERS
        }

    );

}


// ============================================================================
// READ COURSE ID
// ============================================================================

function getCourseId(request) {

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
// FIND ACCOUNT FOR COURSE
// ============================================================================
//
// Matches:
//
//   tokens.json -> data[].batch_id
//
// against:
//
//   /api/subjects?id=
//
// Supported:
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
// The returned credentials stay server-side.
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
// BUILD SUBJECT API URL
// ============================================================================

function buildSubjectUrl(
    courseId
) {

    const url =
        new URL(
            SUBJECT_API
        );


    url.searchParams.set(
        "courseid",
        courseId
    );


    url.searchParams.set(
        "start",
        "-1"
    );


    return url.toString();

}


// ============================================================================
// FETCH SUBJECTS USING MATCHED ACCOUNT
// ============================================================================

async function fetchSubjects(
    courseId,
    account
) {

    const subjectUrl =
        buildSubjectUrl(
            courseId
        );


    const response =
        await fetch(

            subjectUrl,

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
            `Subject API returned HTTP ${response.status}`
        );

    }


    let json;


    try {

        json =
            await response.json();

    } catch {

        throw new Error(
            "Subject API returned invalid JSON."
        );

    }


    if (
        !json ||
        typeof json !== "object"
    ) {

        throw new Error(
            "Invalid Subject API response."
        );

    }


    return json;

}


// ============================================================================
// MAIN GET
// ============================================================================

export async function onRequestGet(
    context
) {

    const request =
        context.request;


    try {

        // =====================================================================
        // 1. READ COURSE ID
        // =====================================================================

        const courseId =
            getCourseId(
                request
            );


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
                        "Use /api/subjects?id=COURSE_ID",

                    data:
                        []

                },

                400

            );

        }


        // =====================================================================
        // 2. GET TOKENS.JSON
        // =====================================================================

        const tokenResponse =
            await fetchTokens(
                context.request,
                context.env
            );


        // =====================================================================
        // 3. MATCH batch_id
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

                    data:
                        []

                },

                404

            );

        }


        // =====================================================================
        // 4. CALL SUBJECT API
        // =====================================================================

        const upstream =
            await fetchSubjects(

                courseId,

                account

            );


        // =====================================================================
        // 5. RETURN CLEAN RESPONSE
        // =====================================================================
        //
        // Do NOT return:
        //   account.userId
        //   account.token
        //
        // =====================================================================

        const response = {

            status:
                200,

            courseId,

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


    } catch (error) {

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
