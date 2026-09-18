// ============================================================================
// CLOUDFLARE PAGES FUNCTION
// FILE: /functions/api/my-batches.js
//
// URL:
//   /api/my-batches
//
// PAGINATION:
//   /api/my-batches?page=1
//   /api/my-batches?page=2
//   /api/my-batches?page=3
//
// DUPLICATE ACCOUNT RULE:
//   same userId + same token       => REMOVE DUPLICATE
//   same userId + different token  => KEEP BOTH
//
// Each page:
//   1 request -> tokens.json
//   up to 40 -> account API requests
//
// RESPONSE NOW INCLUDES:
//
// {
//     "batch": {...},
//     "account": {
//         "userId": "...",
//         "token": "..."
//     }
// }
//
// So every batch tells you exactly which account returned it.
// ============================================================================


// ============================================================================
// URLS
// ============================================================================

function getTokensUrl(request, env) {
    if (env && env.TOKENS_URL) {
        return env.TOKENS_URL;
    }
    if (request && request.url) {
        return new URL("/tokens.json", request.url).href;
    }
    return "/tokens.json";
}

const COURSE_API =
    "https://sachinacademyapi.classx.co.in/get/mycourseweb";


// ============================================================================
// SETTINGS
// ============================================================================

const PAGE_SIZE = 40;

// Keep concurrency at 5.
const CONCURRENCY = 5;

const TOKENS_TIMEOUT = 10000;
const API_TIMEOUT = 10000;


// ============================================================================
// CORS / RESPONSE HEADERS
// ============================================================================

const CORS_HEADERS = {

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
// FETCH WITH TIMEOUT
// ============================================================================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 10000
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        return await fetch(
            url,
            {
                ...options,
                signal:
                    controller.signal
            }
        );

    } finally {

        clearTimeout(timer);

    }

}


// ============================================================================
// LOAD COMPLETE TOKENS.JSON
// ============================================================================

async function loadAccounts(request, env) {

    const response =
        await fetchWithTimeout(
            getTokensUrl(request, env),
            {
                method:
                    "GET",

                headers: {

                    "accept":
                        "application/json,text/plain,*/*"

                }
            },
            TOKENS_TIMEOUT
        );


    if (!response.ok) {

        throw new Error(
            `tokens.json returned HTTP ${response.status}`
        );

    }


    const raw =
        await response.text();


    if (!raw.trim()) {

        throw new Error(
            "tokens.json is empty."
        );

    }


    let parsed;


    try {

        parsed =
            JSON.parse(raw);

    } catch {

        throw new Error(
            "tokens.json contains invalid JSON."
        );

    }


    // -------------------------------------------------------------------------
    // SUPPORTED FORMATS
    //
    // [
    //   {
    //      "userId": "...",
    //      "token": "..."
    //   }
    // ]
    //
    // OR
    //
    // {
    //   "tokens": [...]
    // }
    //
    // OR
    //
    // {
    //   "data": [...]
    // }
    // -------------------------------------------------------------------------

    let list = [];


    if (Array.isArray(parsed)) {

        list =
            parsed;

    }

    else if (
        parsed &&
        Array.isArray(parsed.tokens)
    ) {

        list =
            parsed.tokens;

    }

    else if (
        parsed &&
        Array.isArray(parsed.data)
    ) {

        list =
            parsed.data;

    }

    else {

        throw new Error(
            "No account array found in tokens.json."
        );

    }


    const accounts = [];

    const seenPairs =
        new Set();


    for (const item of list) {

        if (
            !item ||
            typeof item !== "object"
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
            rawToken === undefined
        ) {

            continue;

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

            continue;

        }


        // Ignore special placeholder account.
        if (
            token.includes(
                "#SYNC_ACCOUNT#"
            )
        ) {

            continue;

        }


        // Exact userId + token pair.
        const key =
            `${userId}\u0000${token}`;


        if (
            seenPairs.has(key)
        ) {

            continue;

        }


        seenPairs.add(key);


        accounts.push({

            userId,

            token

        });

    }


    return {

        rawEntries:
            list.length,

        validEntries:
            accounts.length,

        duplicatesRemoved:
            list.length -
            accounts.length,

        accounts

    };

}


// ============================================================================
// FETCH COURSES FOR ONE USER/TOKEN
// ============================================================================

async function fetchUserCourses(
    account
) {

    const apiUrl =
        `${COURSE_API}?userid=${encodeURIComponent(
            account.userId
        )}`;


    const headers = {

        "accept":
            "*/*",

        "auth-key":
            "appxapi",

        "authorization":
            account.token,

        "client-service":
            "Appx",

        "device-type":
            "is-safari 0",

        "origin":
            "https://sachinacademy.classx.co.in",

        "referer":
            "https://sachinacademy.classx.co.in/",

        "source":
            "website",

        "user-agent":
            "Mozilla/5.0 (Linux; Android 15) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/153.0.0.0 Mobile Safari/537.36",

        "user-id":
            String(account.userId)

    };


    try {

        const response =
            await fetchWithTimeout(
                apiUrl,
                {
                    method:
                        "GET",

                    headers
                },
                API_TIMEOUT
            );


        // ---------------------------------------------------------------------
        // HTTP ERROR
        // ---------------------------------------------------------------------

        if (!response.ok) {

            return {

                success:
                    false,

                userId:
                    account.userId,

                token:
                    account.token,

                courses:
                    [],

                error:
                    `HTTP ${response.status}`

            };

        }


        // ---------------------------------------------------------------------
        // PARSE JSON
        // ---------------------------------------------------------------------

        let json;


        try {

            json =
                await response.json();

        } catch {

            return {

                success:
                    false,

                userId:
                    account.userId,

                token:
                    account.token,

                courses:
                    [],

                error:
                    "Invalid JSON response"

            };

        }


        // ---------------------------------------------------------------------
        // INVALID DATA
        // ---------------------------------------------------------------------

        if (
            !json ||
            !Array.isArray(
                json.data
            )
        ) {

            return {

                success:
                    false,

                userId:
                    account.userId,

                token:
                    account.token,

                courses:
                    [],

                error:
                    "Response does not contain data[]"

            };

        }


        // ---------------------------------------------------------------------
        // INVALID API STATUS
        // ---------------------------------------------------------------------

        if (
            json.status !== 200 &&
            json.success !== true
        ) {

            return {

                success:
                    false,

                userId:
                    account.userId,

                token:
                    account.token,

                courses:
                    [],

                error:
                    "Account API rejected request"

            };

        }


        // ---------------------------------------------------------------------
        // SUCCESS
        // ---------------------------------------------------------------------

        return {

            success:
                true,

            userId:
                account.userId,

            token:
                account.token,

            courses:
                json.data

        };


    } catch (error) {

        return {

            success:
                false,

            userId:
                account.userId,

            token:
                account.token,

            courses:
                [],

            error:
                error?.message ||
                "Request failed"

        };

    }

}


// ============================================================================
// PROCESS PAGE ACCOUNTS WITH CONTROLLED CONCURRENCY
// ============================================================================

async function processAccounts(
    accounts
) {

    const results = [];


    for (
        let i = 0;
        i < accounts.length;
        i += CONCURRENCY
    ) {

        const group =
            accounts.slice(
                i,
                i + CONCURRENCY
            );


        const groupResults =
            await Promise.all(
                group.map(
                    account =>
                        fetchUserCourses(
                            account
                        )
                )
            );


        results.push(
            ...groupResults
        );

    }


    return results;

}


// ============================================================================
// REMOVE DUPLICATE COURSES
//
// IMPORTANT:
//
// The same batch may exist in multiple accounts.
//
// We keep the first occurrence,
// but now ALSO save the account that returned it.
//
// Example:
//
// {
//     "id": "123",
//     "course_name": "JEE Batch",
//     "account": {
//         "userId": "999",
//         "token": "abc"
//     }
// }
// ============================================================================

function buildUniqueCourses(
    results
) {

    const courseMap =
        new Map();


    let activeAccounts = 0;

    let failedAccounts = 0;

    let totalCoursesBeforeDedup = 0;


    for (
        const result of results
    ) {

        if (
            !result.success
        ) {

            failedAccounts++;

            continue;

        }


        activeAccounts++;


        if (
            !Array.isArray(
                result.courses
            )
        ) {

            continue;

        }


        totalCoursesBeforeDedup +=
            result.courses.length;


        for (
            const course
            of result.courses
        ) {

            if (
                !course ||
                course.id === undefined ||
                course.id === null
            ) {

                continue;

            }


            const courseId =
                String(
                    course.id
                );


            // -----------------------------------------------------------------
            // Keep only the first occurrence of a course ID.
            // But store its account details.
            // -----------------------------------------------------------------

            if (
                !courseMap.has(
                    courseId
                )
            ) {

                courseMap.set(
                    courseId,
                    {

                        // -----------------------------------------------------
                        // BATCH DATA
                        // -----------------------------------------------------

                        id:
                            courseId,

                        course_name:
                            course.course_name ||
                            course.title ||
                            course.name ||
                            "Course Batch",

                        course_thumbnail:
                            course.course_thumbnail ||
                            course.thumbnail ||
                            course.cover ||
                            "",


                        // -----------------------------------------------------
                        // ACCOUNT THAT RETURNED THIS BATCH
                        // -----------------------------------------------------

                        account: {

                            userId:
                                result.userId,

                            token:
                                result.token

                        }

                    }
                );

            }

        }

    }


    return {

        courses:
            Array.from(
                courseMap.values()
            ),

        activeAccounts,

        failedAccounts,

        totalCoursesBeforeDedup

    };

}


// ============================================================================
// GET HANDLER
// ============================================================================

export async function onRequestGet(
    context
) {

    const request =
        context.request;


    const requestUrl =
        new URL(
            request.url
        );


    // -------------------------------------------------------------------------
    // READ PAGE
    // -------------------------------------------------------------------------

    let page =
        Number(
            requestUrl.searchParams.get(
                "page"
            ) || "1"
        );


    if (
        !Number.isFinite(page) ||
        page < 1
    ) {

        page = 1;

    }


    page =
        Math.floor(page);


    // -------------------------------------------------------------------------
    // LOAD ACCOUNTS
    // -------------------------------------------------------------------------

    try {

        const accountData =
            await loadAccounts(
                request,
                context.env
            );


        const allAccounts =
            accountData.accounts;


        if (
            allAccounts.length === 0
        ) {

            return jsonResponse(
                {

                    status:
                        404,

                    error:
                        "No valid accounts found in tokens.json.",

                    data:
                        []

                },
                404
            );

        }


        // ---------------------------------------------------------------------
        // PAGINATION
        // ---------------------------------------------------------------------

        const totalAccounts =
            allAccounts.length;


        const totalPages =
            Math.ceil(
                totalAccounts /
                PAGE_SIZE
            );


        // ---------------------------------------------------------------------
        // PAGE DOES NOT EXIST
        // ---------------------------------------------------------------------

        if (
            page > totalPages
        ) {

            return jsonResponse(
                {

                    status:
                        200,

                    message:
                        "No more pages.",

                    page,

                    pageSize:
                        PAGE_SIZE,

                    totalPages,

                    hasNextPage:
                        false,

                    nextUrl:
                        null,

                    data:
                        []

                },
                200
            );

        }


        const startIndex =
            (page - 1) *
            PAGE_SIZE;


        const endIndex =
            Math.min(
                startIndex +
                PAGE_SIZE,
                totalAccounts
            );


        const pageAccounts =
            allAccounts.slice(
                startIndex,
                endIndex
            );


        // ---------------------------------------------------------------------
        // FETCH THIS PAGE
        // ---------------------------------------------------------------------

        const results =
            await processAccounts(
                pageAccounts
            );


        // ---------------------------------------------------------------------
        // BUILD UNIQUE COURSES + ACCOUNT INFO
        // ---------------------------------------------------------------------

        const output =
            buildUniqueCourses(
                results
            );


        // ---------------------------------------------------------------------
        // NEXT PAGE
        // ---------------------------------------------------------------------

        const hasNextPage =
            page <
            totalPages;


        const nextPage =
            hasNextPage
                ? page + 1
                : null;


        const nextUrl =
            hasNextPage
                ? buildPageUrl(
                    requestUrl,
                    nextPage
                )
                : null;


        // ---------------------------------------------------------------------
        // PREVIOUS PAGE
        // ---------------------------------------------------------------------

        const hasPreviousPage =
            page > 1;


        const previousPage =
            hasPreviousPage
                ? page - 1
                : null;


        const previousUrl =
            hasPreviousPage
                ? buildPageUrl(
                    requestUrl,
                    previousPage
                )
                : null;


        // ---------------------------------------------------------------------
        // ACCOUNT RESULTS
        //
        // This shows which accounts were fetched on this page
        // and whether their API request succeeded.
        // ---------------------------------------------------------------------

        const accounts =
            results.map(
                result => ({

                    userId:
                        result.userId,

                    token:
                        result.token,

                    success:
                        result.success,

                    courseCount:
                        Array.isArray(
                            result.courses
                        )
                            ? result.courses.length
                            : 0,

                    error:
                        result.success
                            ? null
                            : result.error || null

                })
            );


        // ---------------------------------------------------------------------
        // FINAL RESPONSE
        // ---------------------------------------------------------------------

        const response = {

            status:
                200,

            message:
                `Processed ${pageAccounts.length} ` +
                `accounts from page ${page} of ${totalPages}.`,

            pagination: {

                page,

                pageSize:
                    PAGE_SIZE,

                totalPages,

                totalAccounts,

                accountsFrom:
                    startIndex + 1,

                accountsTo:
                    endIndex,

                hasPreviousPage,

                previousPage,

                previousUrl,

                hasNextPage,

                nextPage,

                nextUrl

            },


            // -----------------------------------------------------------------
            // ACCOUNT INFORMATION FOR THIS PAGE
            // -----------------------------------------------------------------

            accounts,


            // -----------------------------------------------------------------
            // STATISTICS
            // -----------------------------------------------------------------

            stats: {

                rawTokenEntries:
                    accountData.rawEntries,

                exactDuplicatesRemoved:
                    accountData.duplicatesRemoved,

                totalUniqueUserIdTokenPairs:
                    accountData.validEntries,

                accountsProcessedThisPage:
                    pageAccounts.length,

                activeAccounts:
                    output.activeAccounts,

                failedAccounts:
                    output.failedAccounts,

                coursesBeforeDedup:
                    output.totalCoursesBeforeDedup,

                uniqueBatches:
                    output.courses.length

            },


            // -----------------------------------------------------------------
            // FINAL BATCH DATA
            //
            // Every batch has:
            //
            // id
            // course_name
            // course_thumbnail
            // account.userId
            // account.token
            // -----------------------------------------------------------------

            data:
                output.courses

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

                page

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
                CORS_HEADERS

        }
    );

}


// ============================================================================
// BUILD NEXT / PREVIOUS URL
// ============================================================================

function buildPageUrl(
    currentUrl,
    page
) {

    const url =
        new URL(
            currentUrl.toString()
        );


    url.searchParams.set(
        "page",
        String(page)
    );


    return url.toString();

}


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
                CORS_HEADERS

        }

    );

      }
