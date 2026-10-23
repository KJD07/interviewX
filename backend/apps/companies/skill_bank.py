"""
Curated skill-practice catalog: skills (Company rows with kind="skill") ->
one "Intermediate" track -> three rounds -> hand-written questions with
ideal answers. The interviewer asks a round's questions in order and grades
against the ideal answers; /practice scores typed answers against them too.

`sync_skill_bank()` is idempotent and additive: it creates missing skills,
rounds and questions (matched by name/title/question text) and never edits or
deletes anything an admin changed. It runs from a data migration, so every
deploy picks up new entries, and from `manage.py seed_skills`.

To add content: append to SKILLS, then run `manage.py seed_skills` (or ship a
new migration that calls sync_skill_bank, like 0010_seed_skill_bank).
"""

from __future__ import annotations

ROLE_TITLE = "Intermediate"


def Q(question, answer, kind="other"):
    return {"question_type": kind, "question_text": question, "ideal_answer": answer}


def Code(question, answer, language, starter=""):
    return {"question_type": "coding", "question_text": question, "ideal_answer": answer,
            "language": language, "starter_code": starter}


def Design(question, answer):
    return Q(question, answer, "system_design")


def Behavioral(question, answer):
    return Q(question, answer, "behavioral")


SKILLS = [
    # ------------------------------------------------------------------ Frontend
    {
        "name": "JavaScript", "category": "Frontend", "tone_style": "formal_strict",
        "description": "Core language fundamentals, async patterns, and the event loop.",
        "rounds": [
            ("Fundamentals", "technical", [
                Q("What is the difference between var, let and const?",
                  "var is function-scoped and hoisted (initialised to undefined), so it can be used before its "
                  "declaration and leaks out of blocks. let and const are block-scoped and sit in the temporal dead "
                  "zone until declared. const prevents reassignment of the binding but does not make objects immutable."),
                Q("Explain == versus === in JavaScript.",
                  "=== is strict equality: no type coercion, so values must have the same type and value. == performs "
                  "type coercion first (e.g. '1' == 1 and null == undefined are true). Prefer === to avoid surprising "
                  "coercion bugs; NaN is not equal to itself under either."),
                Q("What is a closure? Give a practical use.",
                  "A closure is a function that remembers the variables of the scope it was created in, even after that "
                  "outer function has returned. Uses: data privacy (module pattern, private counters), function "
                  "factories, memoisation, and callbacks/event handlers that need captured state."),
            ]),
            ("Async & Promises", "technical", [
                Q("Explain the event loop, including microtasks and macrotasks.",
                  "JavaScript runs on a single call stack. Async work (timers, I/O) is handled by the host and its "
                  "callbacks are queued. After the stack empties, the event loop drains the entire microtask queue "
                  "(promise callbacks, queueMicrotask) before taking the next macrotask (setTimeout, I/O, events). So "
                  "Promise.then runs before setTimeout(fn, 0)."),
                Q("What is the difference between Promise.all, Promise.allSettled, Promise.race and Promise.any?",
                  "Promise.all resolves with all results and rejects as soon as one rejects. allSettled waits for all "
                  "and returns each status/value/reason. race settles with the first promise to settle, either way. "
                  "any resolves with the first fulfilled promise and rejects with an AggregateError only if all reject."),
                Code("Write a function `sleep(ms)` that returns a promise, then a function `retry(fn, attempts)` that "
                     "calls the async function fn and retries it up to `attempts` times, waiting 100ms between tries.",
                     "sleep returns new Promise(resolve => setTimeout(resolve, ms)). retry loops attempts times: try "
                     "return await fn(); catch the error, remember it, and if attempts remain await sleep(100); after the "
                     "loop rethrow the last error. Uses async/await with try/catch.",
                     "javascript",
                     "function sleep(ms) {\n  // TODO\n}\n\nasync function retry(fn, attempts) {\n  // TODO\n}\n"),
            ]),
            ("Advanced Concepts", "technical", [
                Q("How does `this` work in JavaScript, and how do arrow functions change it?",
                  "this is decided by how a function is called: method call -> the object, plain call -> undefined in "
                  "strict mode (global object otherwise), new -> the new instance, call/apply/bind -> the given value. "
                  "Arrow functions have no own this; they capture this lexically from the enclosing scope, so they "
                  "cannot be rebound."),
                Q("Explain prototypal inheritance and how `class` relates to it.",
                  "Every object has an internal [[Prototype]] link; property lookups walk up this prototype chain. "
                  "Constructor functions put shared methods on Function.prototype. ES6 class is syntactic sugar over the "
                  "same mechanism: methods live on the prototype, extends sets up the chain, and super calls the parent."),
                Code("Implement `debounce(fn, wait)` that delays calling fn until `wait` ms have passed since the last "
                     "call, forwarding the latest arguments.",
                     "Keep a timer id in a closure. Return a function that clears the existing timer with clearTimeout "
                     "and sets a new setTimeout that calls fn.apply(this, args) after wait ms. Only the last call within "
                     "the window fires.",
                     "javascript",
                     "function debounce(fn, wait) {\n  // TODO\n}\n"),
            ]),
        ],
    },
    {
        "name": "TypeScript", "category": "Frontend", "tone_style": "formal_strict",
        "description": "Type system, generics, narrowing, and typing real-world code.",
        "rounds": [
            ("Type System Basics", "technical", [
                Q("What is the difference between `interface` and `type` in TypeScript?",
                  "Both describe object shapes. interface can be extended with extends and reopened via declaration "
                  "merging; type aliases can't be merged but can express unions, intersections, tuples, primitives and "
                  "mapped/conditional types. Use interface for public object contracts and type for compositions."),
                Q("Explain `any`, `unknown` and `never`.",
                  "any turns type checking off for that value. unknown is the type-safe top type: you must narrow it "
                  "(typeof, instanceof, type guards) before using it. never is the bottom type for values that cannot "
                  "exist, e.g. a function that always throws or the exhausted branch of a switch."),
                Q("What is type narrowing? Name some ways TypeScript narrows types.",
                  "Narrowing refines a union to a more specific type inside a code path. TypeScript narrows via typeof, "
                  "instanceof, the in operator, equality checks, truthiness checks, discriminated unions (a shared "
                  "literal kind field), and user-defined type guards (x is T)."),
            ]),
            ("Generics & Utility Types", "technical", [
                Q("Why use generics? Give an example.",
                  "Generics let one function or type work across many types while keeping type information, instead of "
                  "falling back to any. Example: function first<T>(items: T[]): T | undefined returns the element type "
                  "of whatever array you pass. Constraints like <T extends { id: string }> limit what T can be."),
                Q("Explain Partial, Pick, Omit and Record.",
                  "Partial<T> makes all properties optional; Pick<T, K> keeps only keys K; Omit<T, K> removes keys K; "
                  "Record<K, V> builds an object type whose keys are K and values V. They are mapped types built into "
                  "the standard library."),
                Code("Write a generic function `groupBy` that takes an array and a key-selector function and returns a "
                     "Record from key to array of items.",
                     "function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]>. "
                     "Start from an empty object cast as Record<K, T[]>, loop the items, compute k = key(item), create the "
                     "array if missing and push the item, then return the record.",
                     "typescript",
                     "function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> {\n"
                     "  // TODO\n}\n"),
            ]),
            ("Typing Real-World Code", "technical", [
                Q("What is a discriminated union and why is it useful?",
                  "A union of object types that share a literal field (e.g. status: 'loading' | 'success' | 'error'). "
                  "Checking that field narrows to the exact variant, so each branch only accesses valid fields, and an "
                  "exhaustive switch with a never check catches unhandled cases at compile time."),
                Q("How would you type an API response from fetch safely?",
                  "fetch returns unknown data at runtime, so a type annotation alone is only a promise. Define the "
                  "response type, then validate at the boundary (a schema library like zod, or a type guard) before "
                  "treating it as that type. Handle error statuses separately and avoid casting with as."),
                Q("What does `strict` mode enable and why turn it on?",
                  "strict enables strictNullChecks, noImplicitAny, strictFunctionTypes, strictBindCallApply, "
                  "strictPropertyInitialization, useUnknownInCatchVariables and alwaysStrict. It catches null/undefined "
                  "bugs and implicit any, which are the most common runtime errors, so new projects should always use it."),
            ]),
        ],
    },
    {
        "name": "React", "category": "Frontend", "tone_style": "casual_friendly",
        "description": "Component architecture, hooks, state management, and performance.",
        "rounds": [
            ("Core Concepts", "technical", [
                Q("What is the virtual DOM and how does reconciliation work?",
                  "React keeps a lightweight tree of elements. On state change it re-renders components to produce a new "
                  "tree, diffs it against the previous one (reconciliation), and applies only the minimal changes to the "
                  "real DOM. It assumes elements of different types produce different trees and uses keys to match "
                  "list children."),
                Q("Why do list items need a `key`, and why is the array index a poor key?",
                  "Keys let React identify which item is which between renders so it can keep state and DOM nodes with "
                  "the right item. Index keys break when items are inserted, removed or reordered: state and inputs end "
                  "up attached to the wrong item. Use a stable unique id."),
                Q("What is the difference between props and state?",
                  "Props are inputs passed from the parent and are read-only inside the component. State is data owned "
                  "by the component that changes over time via setState/useState and triggers a re-render. Lift state up "
                  "to the closest common parent when siblings need to share it."),
            ]),
            ("Hooks & State Management", "technical", [
                Q("Explain useEffect's dependency array and the cleanup function.",
                  "The effect runs after render; with [] it runs once after mount, with [a, b] whenever a or b changes, "
                  "and with no array after every render. The returned cleanup runs before the next effect and on unmount "
                  "to remove listeners, cancel requests or clear timers. Missing dependencies cause stale values."),
                Q("When would you use useMemo, useCallback and React.memo?",
                  "React.memo skips re-rendering a component when its props are shallowly equal. useCallback keeps a "
                  "function reference stable and useMemo caches an expensive computed value between renders. Use them "
                  "when profiling shows wasted renders or costly calculations, not by default."),
                Code("Write a custom hook `useDebouncedValue(value, delay)` that returns the value only after it has "
                     "stopped changing for `delay` ms.",
                     "Hold debounced state with useState(value). In useEffect on [value, delay], start setTimeout that "
                     "sets the debounced state after delay, and return a cleanup that clears the timeout so rapid changes "
                     "restart the timer. Return the debounced value.",
                     "javascript",
                     "import { useEffect, useState } from 'react';\n\nexport function useDebouncedValue(value, delay) {\n"
                     "  // TODO\n}\n"),
            ]),
            ("Performance & Debugging", "technical", [
                Q("A list of 10,000 rows renders slowly. How would you fix it?",
                  "Measure first with the React Profiler. Then virtualise the list (react-window) so only visible rows "
                  "render, memoise row components, keep stable keys and callbacks, avoid recreating objects in props, "
                  "paginate or lazy-load data, and move heavy work out of render."),
                Q("What causes unnecessary re-renders, and how do you find them?",
                  "A component re-renders when its state changes, its parent re-renders, or a context it reads changes. "
                  "New object/function props each render defeat memo. Find them with the React DevTools Profiler and "
                  "'highlight updates', then split context, memoise, or move state down closer to where it's used."),
                Q("How does code splitting work in React?",
                  "Load parts of the app on demand instead of in one bundle: React.lazy with dynamic import() and a "
                  "Suspense fallback, route-level splitting, or next/dynamic in Next.js. It reduces initial bundle size "
                  "and time to interactive."),
            ]),
        ],
    },
    {
        "name": "HTML & CSS", "category": "Frontend", "tone_style": "casual_friendly",
        "description": "Semantic HTML, layout with Flexbox and Grid, responsive design, and accessibility.",
        "rounds": [
            ("Semantic HTML & Accessibility", "technical", [
                Q("Why does semantic HTML matter?",
                  "Elements like header, nav, main, article, button and label describe meaning, so screen readers, "
                  "search engines and browsers understand the page. It gives keyboard support and accessibility for free "
                  "(a button is focusable and clickable with Enter/Space) and improves SEO and maintainability."),
                Q("How would you make a custom dropdown accessible?",
                  "Prefer a native select. If custom: use a button that toggles a listbox, manage aria-expanded, "
                  "aria-controls and role='listbox'/'option', support keyboard (arrow keys, Enter, Escape, Tab), move "
                  "and trap focus correctly, show a visible focus style, and keep a text label."),
                Q("What is the difference between `display: none`, `visibility: hidden` and `opacity: 0`?",
                  "display: none removes the element from layout and the accessibility tree. visibility: hidden keeps "
                  "its space but hides it and it is not interactive. opacity: 0 is invisible but still takes space and "
                  "still receives clicks and focus."),
            ]),
            ("Layout: Flexbox & Grid", "technical", [
                Q("When would you choose Flexbox versus CSS Grid?",
                  "Flexbox is one-dimensional: distributing items along a row or column (navbars, toolbars, centering). "
                  "Grid is two-dimensional: rows and columns together (page layouts, card galleries). They combine well, "
                  "e.g. a grid layout whose cells use flex."),
                Q("Explain the CSS box model and `box-sizing: border-box`.",
                  "Every box is content + padding + border + margin. By default width sets only the content width, so "
                  "padding and border add to it. border-box makes width include padding and border, which makes sizing "
                  "predictable; most resets apply it globally."),
                Q("How does CSS specificity work?",
                  "When rules conflict, the more specific selector wins: inline styles > IDs > classes/attributes/"
                  "pseudo-classes > elements/pseudo-elements. Equal specificity falls back to source order. !important "
                  "overrides normal rules and should be avoided."),
            ]),
            ("Responsive Design", "technical", [
                Q("How do you build a responsive layout?",
                  "Mobile-first CSS with fluid widths (%, fr, minmax, clamp), flexible images (max-width: 100%), media "
                  "queries or container queries at breakpoints where the content breaks, the viewport meta tag, and "
                  "relative units like rem."),
                Q("What are rem, em, vw and % relative to?",
                  "rem is relative to the root html font size, em to the current element's font size (compounds when "
                  "nested), vw/vh to 1% of the viewport width/height, and % to the parent's corresponding dimension."),
                Q("How would you improve a page's Core Web Vitals from the CSS/HTML side?",
                  "Reserve space for images and embeds with width/height or aspect-ratio to avoid layout shift (CLS), "
                  "preload the hero image and critical fonts, use font-display: swap, inline critical CSS and defer the "
                  "rest, lazy-load below-the-fold images, and avoid layout thrash for better INP."),
            ]),
        ],
    },
    {
        "name": "Next.js", "category": "Frontend", "tone_style": "casual_friendly",
        "description": "App Router, rendering strategies, data fetching, and deployment.",
        "rounds": [
            ("Rendering Strategies", "technical", [
                Q("Explain SSR, SSG, ISR and CSR.",
                  "SSR renders HTML on the server per request (fresh, personalised data). SSG renders at build time and "
                  "serves static files (fastest). ISR serves static pages but regenerates them in the background after a "
                  "revalidate interval. CSR renders in the browser after loading JavaScript."),
                Q("What are React Server Components and how do they differ from Client Components?",
                  "Server Components render on the server, can fetch data and access backend resources directly, and "
                  "send no JavaScript to the client. Client Components ('use client') run in the browser and can use "
                  "state, effects and event handlers. Keep components server-side by default and push interactivity "
                  "to small client leaves."),
                Q("How does caching and revalidation work for fetch in the App Router?",
                  "fetch results can be cached and reused. You control it per request with cache: 'no-store' for always "
                  "fresh data or next: { revalidate: seconds } for time-based ISR, and invalidate on demand with "
                  "revalidatePath or revalidateTag after a mutation."),
            ]),
            ("Routing & Data Fetching", "technical", [
                Q("How do layouts, loading.tsx and error.tsx work in the App Router?",
                  "layout.tsx wraps a route segment and its children and persists across navigation. loading.tsx is an "
                  "automatic Suspense fallback shown while the segment loads. error.tsx is a client error boundary for "
                  "that segment with a reset function."),
                Q("What are Server Actions?",
                  "Async functions marked 'use server' that run on the server and can be called from forms or client "
                  "components to mutate data without writing an API route. Validate inputs and check auth inside them, "
                  "then revalidate affected paths."),
                Q("How do you protect routes that require login?",
                  "Check the session in middleware to redirect unauthenticated users early, and also verify auth on the "
                  "server in the page/route handler or action, since middleware alone is not a security boundary. "
                  "Never trust client-only checks."),
            ]),
            ("Performance & Deployment", "technical", [
                Q("How does next/image improve performance?",
                  "It serves resized, modern-format (WebP/AVIF) images per device, lazy-loads by default, requires "
                  "dimensions to prevent layout shift, and supports priority for the LCP image."),
                Q("How would you reduce the JavaScript bundle size of a Next.js app?",
                  "Keep components as Server Components, use dynamic imports for heavy client-only widgets, analyse with "
                  "the bundle analyzer, replace heavy libraries, tree-shake imports, and avoid importing server-only "
                  "code into client components."),
                Q("What environment variables are exposed to the browser in Next.js?",
                  "Only variables prefixed with NEXT_PUBLIC_ are inlined into the client bundle at build time. All others "
                  "are server-only. Secrets must never use the NEXT_PUBLIC_ prefix."),
            ]),
        ],
    },
    # ------------------------------------------------------------------ Backend
    {
        "name": "Python", "category": "Backend", "tone_style": "casual_friendly",
        "description": "Language fundamentals, OOP, and common backend patterns.",
        "rounds": [
            ("Fundamentals", "technical", [
                Q("What is the difference between a list and a tuple? When would you use each?",
                  "Lists are mutable and tuples are immutable. Tuples are hashable when their contents are, so they can "
                  "be dict keys or set members, and they signal a fixed record. Use lists for collections that change."),
                Q("Explain mutable default arguments and why they are a bug.",
                  "Default values are evaluated once, when the function is defined, so a default like [] is shared "
                  "across calls and keeps growing. Use None as the default and create a new list inside the function."),
                Code("Write a function that returns the k most frequent words in a string (case-insensitive).",
                     "Lower-case the text, split into words (regex \\w+), count with collections.Counter, and return "
                     "[w for w, _ in counter.most_common(k)]. O(n log k) or O(n log n) time.",
                     "python",
                     "def top_k_words(text: str, k: int) -> list[str]:\n    pass\n"),
            ]),
            ("OOP & Design", "technical", [
                Q("What are decorators and how do they work?",
                  "A decorator is a callable that takes a function and returns a new function wrapping it, applied with "
                  "@ syntax. It's used for logging, caching, auth checks and retries. Use functools.wraps to keep the "
                  "original name and docstring."),
                Q("Explain @staticmethod, @classmethod and instance methods.",
                  "Instance methods receive self and work on an instance. classmethods receive cls and are used for "
                  "alternative constructors or class-level state. staticmethods receive neither and are plain functions "
                  "namespaced inside the class."),
                Q("What are generators and why use them?",
                  "Functions that use yield to produce values lazily, one at a time, keeping their state between calls. "
                  "They save memory for large or infinite sequences and streaming data (e.g. reading a big file line by "
                  "line) and can be composed into pipelines."),
            ]),
            ("Backend Patterns", "technical", [
                Q("What is the GIL and how does it affect concurrency?",
                  "The Global Interpreter Lock lets only one thread execute Python bytecode at a time in CPython. Threads "
                  "still help for I/O-bound work because the GIL is released while waiting. For CPU-bound work use "
                  "multiprocessing or native extensions; asyncio suits many concurrent I/O tasks."),
                Q("When would you use asyncio instead of threads?",
                  "For high-concurrency I/O-bound work (many network calls) where cooperative coroutines are cheaper "
                  "than threads. All libraries in the path must be async; blocking calls stall the event loop and should "
                  "go to a thread pool."),
                Q("How do you manage dependencies and environments in a Python project?",
                  "Use an isolated virtual environment per project (venv, poetry, uv), pin dependencies in a lock or "
                  "requirements file for reproducible builds, separate dev dependencies, and keep secrets in environment "
                  "variables rather than code."),
            ]),
        ],
    },
    {
        "name": "Java", "category": "Backend", "tone_style": "formal_strict",
        "description": "Core Java, collections, OOP, concurrency, and the JVM.",
        "rounds": [
            ("Core Java & OOP", "technical", [
                Q("What is the difference between == and equals() in Java? Why override hashCode with equals?",
                  "== compares references for objects (values for primitives); equals compares logical equality. If you "
                  "override equals you must override hashCode so equal objects have equal hash codes, otherwise "
                  "HashMap and HashSet will not find them."),
                Q("Why are Strings immutable in Java?",
                  "Immutability allows the string pool to share instances, makes strings safe to use as HashMap keys "
                  "(the hash can be cached), makes them thread-safe, and prevents security issues when they're used for "
                  "class names, paths or credentials. Use StringBuilder for repeated concatenation."),
                Q("Abstract class versus interface — when to use which?",
                  "An interface defines a contract a class can implement alongside others (multiple inheritance of type), "
                  "with default methods since Java 8. An abstract class can hold state, constructors and shared "
                  "implementation but a class can extend only one. Use interfaces for capabilities, abstract classes for "
                  "a common base."),
            ]),
            ("Collections & Concurrency", "technical", [
                Q("How does HashMap work internally?",
                  "It stores entries in an array of buckets indexed by the key's hash. Collisions are chained in a "
                  "linked list, converted to a balanced tree when a bucket grows past 8 entries. When size exceeds "
                  "capacity times load factor (0.75) it resizes and rehashes. Get/put are O(1) on average."),
                Q("What is the difference between synchronized, volatile and the java.util.concurrent locks?",
                  "volatile guarantees visibility of a variable across threads but not atomicity. synchronized gives "
                  "mutual exclusion plus visibility on a monitor. ReentrantLock adds tryLock, timeouts, fairness and "
                  "multiple conditions. For counters prefer atomic classes like AtomicInteger."),
                Code("Write a method that returns the first non-repeating character in a string, or '_' if none.",
                     "Count characters with a LinkedHashMap<Character, Integer> (or an int[256] array) in one pass, then "
                     "scan the string again and return the first character whose count is 1. O(n) time.",
                     "java",
                     "public static char firstUnique(String s) {\n    // TODO\n}\n"),
            ]),
            ("JVM & Modern Java", "technical", [
                Q("Explain how garbage collection works in the JVM.",
                  "Objects live on the heap; the GC reclaims objects no longer reachable from GC roots. The heap is "
                  "generational: most objects die young in the young generation (cheap minor GCs), survivors are "
                  "promoted to the old generation. Collectors like G1 and ZGC trade throughput for low pause times."),
                Q("What are streams and lambdas used for in Java 8+?",
                  "Lambdas are concise implementations of functional interfaces. Streams process collections "
                  "declaratively with map, filter, reduce and collect, lazily, and can run in parallel. They make data "
                  "transformations shorter and clearer."),
                Q("What is Optional and how should it be used?",
                  "A container that may or may not hold a value, used as a method return type to make absence explicit "
                  "instead of returning null. Use map, orElse, orElseThrow; don't use it for fields or parameters, and "
                  "avoid calling get() without checking."),
            ]),
        ],
    },
    {
        "name": "Node.js", "category": "Backend", "tone_style": "casual_friendly",
        "description": "Event loop, Express, middleware, and API design.",
        "rounds": [
            ("Core Concepts & Event Loop", "technical", [
                Q("How does Node.js handle many concurrent requests on a single thread?",
                  "Node uses a single-threaded event loop with non-blocking I/O. I/O is delegated to the OS or libuv's "
                  "thread pool, and callbacks run when results are ready, so one thread can juggle thousands of "
                  "connections. CPU-heavy work blocks the loop and should go to worker threads or another service."),
                Q("What is the difference between process.nextTick, setImmediate and setTimeout?",
                  "process.nextTick callbacks run right after the current operation, before promise microtasks and any "
                  "I/O. setImmediate runs in the check phase after I/O polling. setTimeout(fn, 0) runs in the timers "
                  "phase after at least the delay. Overusing nextTick can starve I/O."),
                Q("What are streams in Node and why use them?",
                  "Streams process data in chunks (readable, writable, duplex, transform) instead of loading it all into "
                  "memory, which suits large files and network data. pipe/pipeline connects them and handles "
                  "backpressure."),
            ]),
            ("Express & Middleware", "technical", [
                Q("What is middleware in Express and how does next() work?",
                  "Middleware are functions (req, res, next) run in order for each request. They can modify req/res, end "
                  "the response, or call next() to pass control on; next(err) skips to error-handling middleware, which "
                  "has four arguments (err, req, res, next)."),
                Q("How do you handle errors in async Express route handlers?",
                  "Wrap handlers in try/catch and call next(err), or use a wrapper (or Express 5) that forwards rejected "
                  "promises. Register a central error-handling middleware that logs and returns a consistent error "
                  "response without leaking stack traces."),
                Code("Write an Express middleware that rejects requests without a valid `x-api-key` header (compare "
                     "against process.env.API_KEY) with a 401 JSON error.",
                     "function requireApiKey(req, res, next) { const key = req.get('x-api-key'); if (!key || key !== "
                     "process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' }); next(); }. Ideally "
                     "use crypto.timingSafeEqual to compare.",
                     "javascript",
                     "function requireApiKey(req, res, next) {\n  // TODO\n}\n"),
            ]),
            ("API Design", "technical", [
                Q("How do you design a good REST API?",
                  "Use resource-based URLs and HTTP verbs correctly, proper status codes, consistent JSON shapes and "
                  "error format, pagination and filtering, versioning, authentication and rate limiting, idempotent "
                  "PUT/DELETE, and documentation (OpenAPI)."),
                Q("How would you implement rate limiting for an API?",
                  "Track requests per client key (user id, API key or IP) in a shared store like Redis using fixed "
                  "window, sliding window or token bucket algorithms; return 429 with Retry-After when exceeded. Do it at "
                  "the gateway or as middleware."),
                Q("How do you secure a Node.js API?",
                  "Validate and sanitise input, use parameterised queries, authenticate with short-lived tokens, "
                  "authorise every resource access, set security headers (helmet), enable CORS only for known origins, "
                  "rate-limit, keep dependencies patched (npm audit) and keep secrets in env vars."),
            ]),
        ],
    },
    {
        "name": "Django", "category": "Backend", "tone_style": "formal_strict",
        "description": "ORM, views/serializers, auth, and REST API design.",
        "rounds": [
            ("ORM & Models", "technical", [
                Q("What is the N+1 query problem and how do select_related and prefetch_related solve it?",
                  "Looping over objects and touching a related field fires one extra query per object. select_related "
                  "follows ForeignKey/OneToOne with a SQL JOIN in the same query; prefetch_related runs one extra query "
                  "per relation (good for ManyToMany and reverse FKs) and joins in Python."),
                Q("How do Django migrations work?",
                  "makemigrations compares models with the latest migration state and writes migration files; migrate "
                  "applies unapplied migrations in dependency order and records them in django_migrations. Data changes "
                  "use RunPython with historical models. Migrations must be committed with model changes."),
                Q("What are F expressions and Q objects?",
                  "F() refers to a column's value in the database, enabling atomic updates like F('count') + 1 without "
                  "race conditions and field-to-field comparisons. Q() builds complex filters combined with | (OR), "
                  "& (AND) and ~ (NOT)."),
            ]),
            ("Views, Serializers & Auth", "technical", [
                Q("Explain the Django request/response lifecycle.",
                  "The request passes through middleware, the URL resolver picks a view, the view runs (using models, "
                  "forms/serializers) and returns a response, which passes back through middleware in reverse order. "
                  "Signals and exception middleware hook in along the way."),
                Q("In Django REST Framework, what does a serializer do and how do you validate input?",
                  "A serializer converts model instances to JSON-friendly data and validates incoming data back into "
                  "Python objects. Validation uses field types, validate_<field> methods and validate() for cross-field "
                  "checks; is_valid(raise_exception=True) returns 400 with errors."),
                Q("How do authentication and permissions work in DRF?",
                  "Authentication classes (session, token, JWT) identify request.user. Permission classes like "
                  "IsAuthenticated or custom has_permission/has_object_permission decide access, and throttling limits "
                  "rate. Always scope querysets to the user for object-level security."),
            ]),
            ("REST API Design", "technical", [
                Q("How would you paginate and filter a large list endpoint in DRF?",
                  "Use a pagination class (PageNumber, LimitOffset or Cursor for large/real-time data), django-filter or "
                  "query-param filtering, ordering whitelists, and indexes on the filtered/sorted columns. Cursor "
                  "pagination avoids slow OFFSET on large tables."),
                Q("How do you avoid race conditions when two requests update the same row?",
                  "Use atomic updates with F() expressions, select_for_update() inside transaction.atomic() to lock the "
                  "row, unique constraints to let the database reject duplicates, or optimistic locking with a version "
                  "field."),
                Q("How do you run slow work (emails, reports) outside the request?",
                  "Push it to a background job queue (Celery, RQ, Dramatiq) backed by Redis or RabbitMQ and return "
                  "immediately, use transaction.on_commit to enqueue only after the data is saved, and make tasks "
                  "idempotent with retries."),
            ]),
        ],
    },
    {
        "name": "Spring Boot", "category": "Backend", "tone_style": "formal_strict",
        "description": "Dependency injection, REST APIs, JPA, and production readiness.",
        "rounds": [
            ("Core & Dependency Injection", "technical", [
                Q("What is dependency injection and how does Spring implement it?",
                  "Objects receive their dependencies from the container instead of creating them, which decouples code "
                  "and makes testing easy. Spring's IoC container creates beans and wires them, preferably through "
                  "constructor injection, based on @Component/@Service/@Repository and @Configuration/@Bean definitions."),
                Q("What does @SpringBootApplication do?",
                  "It combines @Configuration, @EnableAutoConfiguration (configures beans based on the classpath and "
                  "properties) and @ComponentScan (finds components in the package and sub-packages)."),
                Q("What are bean scopes in Spring?",
                  "singleton (one instance per container, the default), prototype (new instance each time), and in web "
                  "apps request, session and application scopes. Singletons must be stateless or thread-safe."),
            ]),
            ("REST APIs & JPA", "technical", [
                Q("How do you build and validate a REST endpoint in Spring Boot?",
                  "Annotate a class with @RestController and methods with @GetMapping/@PostMapping, bind input with "
                  "@PathVariable, @RequestParam and @RequestBody, validate DTOs with @Valid and Bean Validation "
                  "annotations, and return ResponseEntity with proper status codes. Handle errors in @ControllerAdvice."),
                Q("What is the difference between FetchType.LAZY and EAGER, and what is the N+1 problem in JPA?",
                  "LAZY loads associations on first access, EAGER loads them immediately. Accessing a lazy association in "
                  "a loop issues one query per entity (N+1). Fix with JOIN FETCH, @EntityGraph or batch fetching, and "
                  "default to LAZY."),
                Q("How does @Transactional work?",
                  "Spring wraps the bean in a proxy that starts a transaction before the method and commits after, "
                  "rolling back on runtime exceptions. It only applies to public methods called through the proxy, so "
                  "self-invocation bypasses it. Propagation and isolation levels can be configured."),
            ]),
            ("Production Readiness", "technical", [
                Q("How do you manage configuration across environments?",
                  "Use application.yml with profiles (application-dev.yml, application-prod.yml), environment variables "
                  "and @ConfigurationProperties for typed config, and a secrets manager or vault for credentials."),
                Q("What does Spring Boot Actuator give you?",
                  "Production endpoints for health, metrics (Micrometer, Prometheus), info, environment and logs, used by "
                  "load balancers and monitoring. Expose only what is needed and secure the sensitive endpoints."),
                Q("How would you secure a Spring Boot REST API?",
                  "Spring Security with stateless JWT or OAuth2 resource server, method-level @PreAuthorize, "
                  "BCrypt-hashed passwords, CORS restricted to known origins, input validation, HTTPS, and rate limiting "
                  "at the gateway."),
            ]),
        ],
    },
    # ---------------------------------------------------------------- Databases
    {
        "name": "SQL", "category": "Databases", "tone_style": "formal_strict",
        "description": "Joins, indexing, query optimization, and schema design.",
        "rounds": [
            ("Queries & Joins", "technical", [
                Q("Explain INNER, LEFT, RIGHT and FULL OUTER joins.",
                  "INNER JOIN returns rows with matches in both tables. LEFT JOIN returns all rows from the left table "
                  "plus matches (NULLs otherwise); RIGHT is the mirror. FULL OUTER returns all rows from both, matched "
                  "where possible."),
                Q("What is the difference between WHERE and HAVING?",
                  "WHERE filters rows before grouping and cannot use aggregates. HAVING filters groups after GROUP BY "
                  "and can use aggregates like COUNT(*) > 5."),
                Code("Given employees(id, name, salary, department_id), write a query to find the second highest "
                     "salary in each department.",
                     "Use a window function: SELECT department_id, salary FROM (SELECT department_id, salary, "
                     "DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk FROM employees) t "
                     "WHERE rnk = 2. DENSE_RANK handles ties.",
                     "sql",
                     "-- employees(id, name, salary, department_id)\nSELECT\n"),
            ]),
            ("Indexing & Optimization", "technical", [
                Q("How does a B-tree index speed up queries, and what does it cost?",
                  "It keeps column values sorted in a balanced tree so lookups, range scans and ORDER BY take "
                  "O(log n) instead of scanning the table. Costs: extra storage and slower inserts/updates/deletes "
                  "since the index must be maintained."),
                Q("What is a composite index and why does column order matter?",
                  "An index on several columns sorted by the first, then the second, and so on. It can serve queries "
                  "filtering on a leftmost prefix of the columns (leftmost prefix rule), so put equality-filtered, "
                  "selective columns first and range columns last."),
                Q("A query is slow. How do you investigate?",
                  "Run EXPLAIN / EXPLAIN ANALYZE to see the plan, look for sequential scans, bad row estimates and "
                  "expensive sorts, add or fix indexes, avoid functions on indexed columns and SELECT *, rewrite "
                  "subqueries, and check table statistics."),
            ]),
            ("Schema Design", "system_design", [
                Q("Explain normalization up to 3NF, and when you would denormalize.",
                  "1NF: atomic values, no repeating groups. 2NF: no partial dependency on part of a composite key. "
                  "3NF: no transitive dependencies between non-key columns. Denormalize deliberately for read-heavy "
                  "workloads or reporting, accepting duplication and update complexity."),
                Q("What are ACID properties?",
                  "Atomicity (all or nothing), Consistency (constraints hold before and after), Isolation (concurrent "
                  "transactions don't see each other's partial work), Durability (committed data survives crashes)."),
                Design("Design the tables for an e-commerce order system (users, products, orders, order items, "
                       "payments).",
                       "users(id, email unique), products(id, name, price, stock), orders(id, user_id FK, status, "
                       "created_at, total), order_items(order_id FK, product_id FK, quantity, unit_price snapshot), "
                       "payments(id, order_id FK, amount, status, provider_ref unique). Index foreign keys and "
                       "status/created_at; store price at purchase time; use transactions to decrement stock."),
            ]),
        ],
    },
    {
        "name": "MongoDB", "category": "Databases", "tone_style": "casual_friendly",
        "description": "Document modelling, queries, aggregation, and indexing.",
        "rounds": [
            ("Data Modeling", "technical", [
                Q("When would you embed documents versus reference them in MongoDB?",
                  "Embed when data is read together, owned by the parent and bounded in size (an order's line items). "
                  "Reference when related data is large, unbounded, shared across documents or updated independently "
                  "(users referenced by many posts). Stay under the 16MB document limit."),
                Q("When is MongoDB a better fit than a relational database, and when is it not?",
                  "Good for flexible or evolving schemas, hierarchical documents read as a unit, and horizontal scaling "
                  "via sharding. Weaker for highly relational data needing many joins and complex multi-entity "
                  "transactions, where a relational database is simpler."),
                Q("Does MongoDB support transactions?",
                  "Yes. Single-document operations are always atomic, and multi-document ACID transactions are supported "
                  "on replica sets and sharded clusters since 4.0/4.2, at some performance cost; good schema design "
                  "minimises the need for them."),
            ]),
            ("Queries & Aggregation", "technical", [
                Q("Explain the aggregation pipeline.",
                  "A sequence of stages, each transforming the documents: $match filters, $group aggregates, $project "
                  "reshapes, $sort, $limit, $lookup joins another collection, $unwind flattens arrays. Put $match early "
                  "so indexes are used and fewer documents flow through."),
                Code("Write an aggregation that returns total sales per product category for orders in 2024, highest "
                     "first. orders: {category, amount, createdAt}.",
                     "db.orders.aggregate([{ $match: { createdAt: { $gte: ISODate('2024-01-01'), $lt: "
                     "ISODate('2025-01-01') } } }, { $group: { _id: '$category', total: { $sum: '$amount' } } }, "
                     "{ $sort: { total: -1 } }])",
                     "javascript",
                     "db.orders.aggregate([\n  // TODO\n]);\n"),
                Q("What is the difference between updateOne with $set and replaceOne?",
                  "$set changes only the given fields and keeps the rest of the document. replaceOne swaps the whole "
                  "document (except _id) for the new one, dropping any field not included."),
            ]),
            ("Indexing & Scaling", "technical", [
                Q("How do indexes work in MongoDB and how do you check if a query uses one?",
                  "B-tree indexes on fields (single, compound, multikey for arrays, text, geospatial, TTL). Use "
                  "explain('executionStats') and look for IXSCAN rather than COLLSCAN and compare docs examined to "
                  "docs returned. Compound indexes follow the ESR rule: equality, sort, range."),
                Q("What is a replica set?",
                  "A group of mongod nodes holding the same data: one primary takes writes, secondaries replicate its "
                  "oplog. If the primary fails, an election promotes a secondary, giving high availability. Read "
                  "preference and write concern tune consistency."),
                Q("What is sharding and how do you choose a shard key?",
                  "Horizontal partitioning of a collection across shards. A good shard key has high cardinality, spreads "
                  "writes evenly (avoid monotonically increasing keys or use hashed keys), and matches common queries "
                  "so they target one shard."),
            ]),
        ],
    },
    {
        "name": "DBMS", "category": "CS Fundamentals", "tone_style": "formal_strict",
        "description": "Transactions, concurrency control, normalization, and storage — campus placement staples.",
        "rounds": [
            ("Transactions & Concurrency", "technical", [
                Q("Explain the isolation levels and the anomalies each one prevents.",
                  "Read Uncommitted allows dirty reads. Read Committed prevents dirty reads. Repeatable Read also "
                  "prevents non-repeatable reads. Serializable also prevents phantom reads, behaving as if transactions "
                  "ran one after another. Higher isolation means less concurrency."),
                Q("What is a deadlock in a database and how is it handled?",
                  "Two transactions each hold a lock the other needs, so both wait forever. Databases detect cycles in "
                  "the wait-for graph and abort one transaction as the victim. Prevent by locking resources in a "
                  "consistent order and keeping transactions short."),
                Q("What is two-phase locking?",
                  "A concurrency protocol where a transaction acquires all its locks in a growing phase and releases "
                  "them in a shrinking phase, never acquiring after releasing. It guarantees conflict-serializability; "
                  "strict 2PL holds write locks until commit to avoid cascading aborts."),
            ]),
            ("Normalization & Keys", "technical", [
                Q("Differentiate primary key, candidate key, super key and foreign key.",
                  "A super key is any set of columns that uniquely identifies a row. A candidate key is a minimal super "
                  "key. The primary key is the chosen candidate key (unique, not null). A foreign key references the "
                  "primary key of another table to enforce referential integrity."),
                Q("What is BCNF and how does it differ from 3NF?",
                  "BCNF requires that for every functional dependency X -> Y, X is a super key. 3NF additionally allows "
                  "Y to be a prime attribute (part of a candidate key). BCNF is stricter and removes more redundancy but "
                  "may lose dependency preservation."),
                Q("What is a functional dependency?",
                  "X -> Y means the value of X determines the value of Y: any two rows with the same X have the same Y. "
                  "Functional dependencies drive normalization and key identification."),
            ]),
            ("Storage & Indexing", "technical", [
                Q("Clustered versus non-clustered index?",
                  "A clustered index defines the physical order of rows, so a table has only one (often the primary "
                  "key). A non-clustered index is a separate structure with keys and pointers to rows; a table can have "
                  "many. Range scans on the clustered key are fastest."),
                Q("Why are B+ trees used for database indexes?",
                  "They are balanced and shallow with high fan-out, so lookups take few disk reads. All data pointers "
                  "are in the leaves, which are linked, making range queries and ordered scans efficient."),
                Q("What is the difference between DELETE, TRUNCATE and DROP?",
                  "DELETE removes selected rows, is logged per row, fires triggers and can be rolled back. TRUNCATE "
                  "removes all rows quickly, resets storage and usually identity counters. DROP removes the table "
                  "itself, its structure and data."),
            ]),
        ],
    },
    # ---------------------------------------------------------- CS Fundamentals
    {
        "name": "Data Structures & Algorithms", "category": "CS Fundamentals", "tone_style": "aggressive",
        "description": "Arrays, hashing, trees, graphs, and dynamic programming — the coding-round core.",
        "rounds": [
            ("Arrays, Strings & Hashing", "technical", [
                Code("Given an array of integers and a target, return the indices of the two numbers that add up to "
                     "the target.",
                     "One pass with a hash map from value to index: for each number x at i, if target - x is in the map "
                     "return [map[target - x], i], else store map[x] = i. O(n) time, O(n) space, versus O(n^2) brute "
                     "force.",
                     "python",
                     "def two_sum(nums: list[int], target: int) -> list[int]:\n    pass\n"),
                Code("Find the length of the longest substring without repeating characters.",
                     "Sliding window: keep the last index of each character in a map and a left pointer. For each right "
                     "index, if the character was seen at or after left, move left to last_seen + 1; update last_seen and "
                     "the best length right - left + 1. O(n) time.",
                     "python",
                     "def length_of_longest_substring(s: str) -> int:\n    pass\n"),
                Q("What is the time complexity of operations on a hash map, and what is the worst case?",
                  "Insert, lookup and delete are O(1) on average with a good hash function and resizing; the worst case "
                  "is O(n) when many keys collide into one bucket (O(log n) in Java 8+ tree buckets)."),
            ]),
            ("Trees & Graphs", "technical", [
                Code("Return the level-order traversal of a binary tree as a list of levels.",
                     "BFS with a queue: start with the root, and while the queue is not empty process exactly "
                     "len(queue) nodes to form one level, appending their children. O(n) time and O(width) space.",
                     "python",
                     "def level_order(root) -> list[list[int]]:\n    pass\n"),
                Q("BFS versus DFS — when would you use each?",
                  "BFS explores level by level with a queue and finds shortest paths in unweighted graphs. DFS goes deep "
                  "with recursion or a stack and suits cycle detection, topological sort, connected components and "
                  "backtracking. Both are O(V + E)."),
                Code("Given a grid of '1' (land) and '0' (water), count the number of islands.",
                     "Iterate over cells; when you find an unvisited '1', increment the count and flood-fill it with DFS "
                     "or BFS, marking connected land in 4 directions as visited. O(rows * cols) time.",
                     "python",
                     "def num_islands(grid: list[list[str]]) -> int:\n    pass\n"),
            ]),
            ("Dynamic Programming", "technical", [
                Q("How do you recognise that a problem needs dynamic programming?",
                  "It has optimal substructure (the answer is built from answers to subproblems) and overlapping "
                  "subproblems (the same subproblems recur). Define the state, the recurrence and base cases, then use "
                  "memoised recursion (top-down) or a table (bottom-up)."),
                Code("Climbing stairs: you can take 1 or 2 steps at a time. In how many distinct ways can you reach "
                     "step n?",
                     "ways(n) = ways(n-1) + ways(n-2) with ways(0) = 1 and ways(1) = 1, the Fibonacci recurrence. "
                     "Compute bottom-up with two variables for O(n) time and O(1) space.",
                     "python",
                     "def climb_stairs(n: int) -> int:\n    pass\n"),
                Code("Given coin denominations and an amount, return the fewest coins needed to make the amount, or -1.",
                     "Bottom-up DP: dp[0] = 0 and dp[a] = min(dp[a - c] + 1) over coins c <= a, initialised to "
                     "infinity. Answer dp[amount] or -1 if still infinite. O(amount * coins) time.",
                     "python",
                     "def coin_change(coins: list[int], amount: int) -> int:\n    pass\n"),
            ]),
        ],
    },
    {
        "name": "OOP", "category": "CS Fundamentals", "tone_style": "formal_strict",
        "description": "The four pillars, SOLID, and design patterns.",
        "rounds": [
            ("Four Pillars", "technical", [
                Q("Explain encapsulation, abstraction, inheritance and polymorphism with an example.",
                  "Encapsulation bundles data with methods and hides internal state behind an interface. Abstraction "
                  "exposes what an object does, not how. Inheritance lets a class reuse and extend another. "
                  "Polymorphism lets one interface have many implementations, e.g. Shape.area() differs for Circle and "
                  "Square."),
                Q("What is the difference between method overloading and overriding?",
                  "Overloading is several methods with the same name but different parameters in one class, resolved at "
                  "compile time. Overriding is a subclass redefining a parent method with the same signature, resolved "
                  "at runtime (dynamic dispatch)."),
                Q("Composition versus inheritance — which should you prefer?",
                  "Prefer composition (has-a): build behaviour from smaller objects, which is flexible and avoids "
                  "fragile deep hierarchies. Use inheritance (is-a) only for true subtype relationships that respect "
                  "the Liskov substitution principle."),
            ]),
            ("SOLID Principles", "technical", [
                Q("Explain the SOLID principles.",
                  "Single Responsibility: one reason to change. Open/Closed: open for extension, closed for "
                  "modification. Liskov Substitution: subtypes must be usable in place of their base type. Interface "
                  "Segregation: many small interfaces over one fat one. Dependency Inversion: depend on abstractions, "
                  "not concrete classes."),
                Q("Give an example of a Liskov Substitution violation.",
                  "Square extending Rectangle: setting width on a Square also changes height, so code that expects a "
                  "Rectangle's width and height to be independent breaks. The subtype changes the base's behaviour."),
                Q("How does dependency inversion make code easier to test?",
                  "High-level code depends on an interface (e.g. PaymentGateway) and the concrete implementation is "
                  "injected, so tests can pass a fake or mock instead of calling a real service."),
            ]),
            ("Design Patterns", "system_design", [
                Q("Explain the Singleton pattern and its drawbacks.",
                  "Ensures one instance with a global access point (e.g. config, connection pool). Drawbacks: hidden "
                  "global state, hard to test and mock, and thread-safety concerns with lazy initialisation. Dependency "
                  "injection with a single shared instance is usually better."),
                Q("When would you use the Factory and Strategy patterns?",
                  "Factory centralises object creation so callers don't depend on concrete classes (e.g. creating a "
                  "notifier by channel). Strategy encapsulates interchangeable algorithms behind one interface and picks "
                  "one at runtime (e.g. different pricing or payment methods)."),
                Design("Design the classes for a parking lot system.",
                       "ParkingLot has Levels; Level has ParkingSpots of types (compact, large, bike). Vehicle is "
                       "abstract with Car, Bike, Truck. Ticket records vehicle, spot and entry time; a PricingStrategy "
                       "computes fees; a SpotAllocator finds a free spot of a fitting type. Keep responsibilities "
                       "separate and use enums for spot/vehicle types."),
            ]),
        ],
    },
    {
        "name": "Operating Systems", "category": "CS Fundamentals", "tone_style": "formal_strict",
        "description": "Processes, threads, scheduling, synchronization, and memory management.",
        "rounds": [
            ("Processes & Threads", "technical", [
                Q("What is the difference between a process and a thread?",
                  "A process is an independent program in execution with its own address space and resources. Threads "
                  "are units of execution inside a process that share its memory and files but have their own stack and "
                  "registers. Threads are cheaper to create and switch but need synchronization."),
                Q("What happens during a context switch?",
                  "The OS saves the running process's state (registers, program counter, stack pointer) in its PCB, "
                  "picks another process via the scheduler, and restores its state. It is pure overhead and also "
                  "flushes caches/TLB for process switches."),
                Q("Compare FCFS, SJF, Round Robin and priority scheduling.",
                  "FCFS runs in arrival order (simple, convoy effect). SJF runs the shortest job first (minimal average "
                  "waiting time but needs burst estimates and can starve long jobs). Round Robin gives each process a "
                  "time quantum (fair, good response time). Priority scheduling can starve low priority jobs; aging "
                  "fixes it."),
            ]),
            ("Synchronization & Deadlocks", "technical", [
                Q("What are the four necessary conditions for deadlock?",
                  "Mutual exclusion, hold and wait, no preemption, and circular wait. Breaking any one prevents "
                  "deadlock, e.g. ordering resource acquisition to prevent circular wait."),
                Q("Mutex versus semaphore?",
                  "A mutex is a lock owned by one thread that must release it, giving mutual exclusion. A semaphore is a "
                  "counter allowing up to N concurrent holders and can be signalled by any thread; a binary semaphore is "
                  "similar to a mutex without ownership."),
                Q("What is a race condition and how do you prevent it?",
                  "When the result depends on the timing of threads accessing shared data, e.g. two threads "
                  "incrementing a counter. Prevent with critical sections protected by locks, atomic operations, or "
                  "avoiding shared mutable state."),
            ]),
            ("Memory Management", "technical", [
                Q("What is virtual memory and paging?",
                  "Virtual memory gives each process its own large address space mapped to physical memory. Paging "
                  "splits it into fixed-size pages mapped to frames via page tables; pages not in RAM are loaded from "
                  "disk on a page fault. The TLB caches translations."),
                Q("What is thrashing?",
                  "When processes don't have enough frames for their working set, the system spends most of its time "
                  "swapping pages instead of executing. Fix by reducing the degree of multiprogramming or giving "
                  "processes more memory."),
                Q("Compare FIFO, LRU and Optimal page replacement.",
                  "FIFO evicts the oldest page (simple, suffers Belady's anomaly). LRU evicts the least recently used "
                  "page (good approximation of optimal, costly to implement exactly). Optimal evicts the page used "
                  "furthest in the future; it's a theoretical benchmark."),
            ]),
        ],
    },
    {
        "name": "Computer Networks", "category": "CS Fundamentals", "tone_style": "formal_strict",
        "description": "OSI/TCP-IP models, TCP vs UDP, HTTP, DNS, and what happens when you load a URL.",
        "rounds": [
            ("Models & Protocols", "technical", [
                Q("Explain the OSI model layers and map common protocols to them.",
                  "Physical, Data Link (Ethernet, MAC), Network (IP, routing), Transport (TCP, UDP), Session, "
                  "Presentation (encoding, TLS often placed here) and Application (HTTP, DNS, SMTP). The TCP/IP model "
                  "condenses these into link, internet, transport and application layers."),
                Q("TCP versus UDP?",
                  "TCP is connection-oriented, reliable and ordered with flow and congestion control (web, email, file "
                  "transfer). UDP is connectionless with no delivery guarantees but low overhead and latency (DNS, "
                  "video calls, gaming)."),
                Q("Explain the TCP three-way handshake.",
                  "The client sends SYN with its initial sequence number, the server replies SYN-ACK with its own "
                  "sequence number and acknowledges the client's, and the client sends ACK. Both sides then have agreed "
                  "sequence numbers and the connection is established."),
            ]),
            ("Web & HTTP", "technical", [
                Q("What happens when you type a URL in the browser and press Enter?",
                  "DNS resolves the domain to an IP (browser, OS, resolver caches, then recursive lookup). The browser "
                  "opens a TCP connection and a TLS handshake for HTTPS, sends an HTTP request, the server responds, and "
                  "the browser parses HTML, fetches CSS/JS/images, builds the DOM and CSSOM, and renders the page."),
                Q("What are the differences between HTTP/1.1, HTTP/2 and HTTP/3?",
                  "HTTP/1.1 is text-based with one request at a time per connection. HTTP/2 is binary and multiplexes "
                  "many streams over one TCP connection with header compression. HTTP/3 runs over QUIC on UDP, removing "
                  "TCP head-of-line blocking and speeding up connection setup."),
                Q("How does HTTPS keep data secure?",
                  "TLS authenticates the server with a certificate signed by a trusted CA, uses asymmetric key exchange "
                  "to agree a session key, then encrypts traffic symmetrically with integrity checks, protecting against "
                  "eavesdropping and tampering."),
            ]),
            ("Addressing & Routing", "technical", [
                Q("What is subnetting? How many hosts does a /26 network have?",
                  "Splitting an IP network into smaller networks by borrowing host bits for the network part. A /26 "
                  "leaves 6 host bits: 2^6 = 64 addresses, 62 usable hosts after the network and broadcast addresses."),
                Q("What does DNS do and what are A, CNAME and MX records?",
                  "DNS maps names to records. An A record maps a name to an IPv4 address (AAAA for IPv6), CNAME aliases "
                  "one name to another, and MX lists the mail servers for a domain."),
                Q("What is NAT and why is it used?",
                  "Network Address Translation rewrites private IP addresses to a public one at the router, letting many "
                  "devices share one public IPv4 address, conserving addresses and hiding the internal network."),
            ]),
        ],
    },
    # ----------------------------------------------------------- Architecture
    {
        "name": "System Design", "category": "Architecture", "tone_style": "aggressive",
        "description": "Scalability, tradeoffs, caching, and distributed systems basics.",
        "rounds": [
            ("Fundamentals & Tradeoffs", "system_design", [
                Q("Explain the CAP theorem with an example.",
                  "In a network partition a distributed system must choose between consistency (every read sees the "
                  "latest write) and availability (every request gets a response). Banking ledgers favour consistency; "
                  "a social feed favours availability with eventual consistency."),
                Q("Vertical versus horizontal scaling?",
                  "Vertical scaling adds CPU/RAM to one machine (simple, has a ceiling and a single point of failure). "
                  "Horizontal scaling adds more machines behind a load balancer (near-unlimited, needs stateless "
                  "services, data partitioning and coordination)."),
                Q("How does a load balancer work, and what algorithms can it use?",
                  "It distributes requests across healthy servers using health checks. Algorithms: round robin, "
                  "weighted round robin, least connections, IP/consistent hashing for stickiness. L4 balancers route by "
                  "IP/port, L7 by HTTP content."),
            ]),
            ("Scalability & Caching", "system_design", [
                Q("Explain cache-aside, write-through and write-back caching.",
                  "Cache-aside: the app reads the cache, on a miss loads from the DB and fills the cache; writes go to "
                  "the DB and invalidate the cache. Write-through writes to cache and DB together (consistent, slower "
                  "writes). Write-back writes to the cache and flushes to the DB later (fast, risk of loss)."),
                Q("How would you scale a database that is overloaded with reads? With writes?",
                  "Reads: add caching, read replicas, and query/index optimisation. Writes: batch and queue writes, "
                  "shard/partition the data by a key, move heavy analytics elsewhere, and consider a store designed "
                  "for the write pattern."),
                Q("What is consistent hashing and why is it useful?",
                  "Keys and nodes are placed on a hash ring; each key goes to the next node clockwise. Adding or "
                  "removing a node only moves the keys in its range instead of rehashing everything. Virtual nodes "
                  "spread load evenly. Used in caches and sharded stores."),
            ]),
            ("Case Study Deep Dive", "system_design", [
                Design("Design a URL shortener like bit.ly.",
                       "APIs: create short URL, redirect. Generate unique short codes with base62 encoding of an id from "
                       "a counter/ID generator (or hash with collision checks). Store code -> long URL in a key-value "
                       "store; reads dominate, so cache hot codes in Redis and return 301/302 redirects. Add expiry, "
                       "rate limiting, analytics via async events, and replicate for availability."),
                Design("Design a notification system that sends email, SMS and push notifications.",
                       "Producers call a notification API which validates and enqueues messages to a queue (Kafka/SQS). "
                       "Per-channel workers consume, apply user preferences and rate limits, render templates and call "
                       "providers with retries, exponential backoff and a dead-letter queue. Store status for "
                       "idempotency and tracking."),
                Design("Design a rate limiter for an API used by millions of users.",
                       "Token bucket or sliding window counters keyed by user/API key, stored in Redis with atomic "
                       "operations (Lua/INCR with TTL) so all gateway instances share state. Enforce at the API gateway, "
                       "return 429 with Retry-After, support per-plan limits, and fail open or closed deliberately if "
                       "Redis is down."),
            ]),
        ],
    },
    # ---------------------------------------------------------- DevOps & Cloud
    {
        "name": "Docker", "category": "DevOps", "tone_style": "casual_friendly",
        "description": "Images, containers, Compose, and deployment basics.",
        "rounds": [
            ("Core Concepts", "technical", [
                Q("What is the difference between a container and a virtual machine?",
                  "A VM virtualises hardware and runs a full guest OS on a hypervisor. A container shares the host "
                  "kernel and isolates processes with namespaces and cgroups, so it starts in seconds and is much "
                  "lighter, with weaker isolation than a VM."),
                Q("What is the difference between an image and a container?",
                  "An image is a read-only, layered template built from a Dockerfile. A container is a running instance "
                  "of an image with a thin writable layer on top; many containers can run from one image."),
                Q("How do Docker image layers and build caching work?",
                  "Each Dockerfile instruction creates a layer; unchanged layers are reused from cache. Order "
                  "instructions from least to most frequently changing, e.g. copy the dependency manifest and install "
                  "dependencies before copying source code."),
            ]),
            ("Compose & Networking", "technical", [
                Q("What does Docker Compose do?",
                  "It defines and runs multi-container apps from a YAML file: services, images/builds, ports, "
                  "environment, volumes, networks and dependencies, started together with docker compose up. Services "
                  "reach each other by service name on a shared network."),
                Q("Volumes versus bind mounts?",
                  "Volumes are managed by Docker, stored in Docker's area, portable and best for persistent data like "
                  "databases. Bind mounts map a host path into the container, handy for live code reloading in "
                  "development but tied to the host's file layout."),
                Q("How do containers communicate with each other?",
                  "Containers on the same user-defined bridge network resolve each other by name through Docker's "
                  "built-in DNS. Ports are published to the host only for external access."),
            ]),
            ("Deployment Practices", "technical", [
                Q("How do you make a Docker image small and secure?",
                  "Use slim or distroless base images, multi-stage builds so build tools don't ship, .dockerignore, "
                  "pin versions, run as a non-root user, avoid baking secrets into layers, and scan images for "
                  "vulnerabilities."),
                Code("Write a multi-stage Dockerfile for a Node.js app that builds with `npm run build` and serves "
                     "`dist/server.js` with a non-root user.",
                     "Stage 1 FROM node:20 AS build, WORKDIR /app, COPY package*.json, RUN npm ci, COPY . ., RUN npm run "
                     "build. Stage 2 FROM node:20-slim, WORKDIR /app, COPY package*.json and RUN npm ci --omit=dev, COPY "
                     "--from=build /app/dist ./dist, USER node, EXPOSE 3000, CMD [\"node\", \"dist/server.js\"].",
                     "dockerfile",
                     "# Stage 1: build\nFROM node:20 AS build\n\n# Stage 2: run\n"),
                Q("How should a containerised app handle configuration and secrets?",
                  "Read configuration from environment variables (twelve-factor), inject secrets at runtime from a "
                  "secrets manager or orchestrator secrets, never commit them or bake them into images, and keep the "
                  "same image across environments."),
            ]),
        ],
    },
    {
        "name": "Kubernetes", "category": "DevOps", "tone_style": "formal_strict",
        "description": "Pods, deployments, services, scaling, and troubleshooting.",
        "rounds": [
            ("Core Objects", "technical", [
                Q("Explain Pod, Deployment and Service.",
                  "A Pod is the smallest deployable unit: one or more containers sharing network and storage. A "
                  "Deployment manages ReplicaSets to keep the desired number of pods running and handles rolling "
                  "updates and rollbacks. A Service gives pods a stable virtual IP and DNS name and load-balances "
                  "across them."),
                Q("What are the Service types ClusterIP, NodePort and LoadBalancer? What is an Ingress?",
                  "ClusterIP exposes the service inside the cluster only (default). NodePort opens a port on every "
                  "node. LoadBalancer provisions a cloud load balancer. Ingress routes external HTTP(S) traffic to "
                  "services by host and path through an ingress controller."),
                Q("ConfigMap versus Secret?",
                  "Both inject configuration into pods as environment variables or files. ConfigMaps hold non-sensitive "
                  "config; Secrets hold sensitive data, base64-encoded (not encrypted by default), and should be "
                  "encrypted at rest and access-controlled with RBAC."),
            ]),
            ("Scaling & Deployments", "technical", [
                Q("How does a rolling update work and how do you roll back?",
                  "The Deployment gradually replaces old pods with new ones, controlled by maxSurge and maxUnavailable, "
                  "waiting for readiness before continuing. kubectl rollout undo deployment/<name> reverts to the "
                  "previous ReplicaSet."),
                Q("Liveness versus readiness probes?",
                  "Readiness decides whether a pod receives traffic; failing removes it from Service endpoints. "
                  "Liveness decides whether the container is healthy; failing restarts it. A startup probe protects "
                  "slow-starting apps."),
                Q("How does the Horizontal Pod Autoscaler work?",
                  "It periodically reads metrics (CPU, memory, or custom) from the metrics server and adjusts the "
                  "replica count to keep usage near the target, within min and max replicas. Pods need resource "
                  "requests set for CPU-based scaling."),
            ]),
            ("Troubleshooting", "technical", [
                Q("A pod is in CrashLoopBackOff. How do you debug it?",
                  "kubectl describe pod for events and exit codes, kubectl logs --previous for the crashed container's "
                  "logs, check the command, config/env and secrets, liveness probe settings and resource limits "
                  "(OOMKilled), then reproduce the image locally."),
                Q("What are resource requests and limits?",
                  "Requests are what the scheduler reserves for the container and decide placement. Limits cap usage: "
                  "exceeding a CPU limit throttles, exceeding a memory limit gets the container OOMKilled."),
                Q("A pod is stuck in Pending. What could be the reasons?",
                  "Insufficient CPU/memory on nodes for its requests, node selectors/affinity or taints with no "
                  "matching nodes, an unbound PersistentVolumeClaim, or image pull issues before start. kubectl "
                  "describe pod shows the scheduler's reason."),
            ]),
        ],
    },
    {
        "name": "AWS", "category": "DevOps", "tone_style": "formal_strict",
        "description": "Core services, architecture on AWS, security, and cost.",
        "rounds": [
            ("Core Services", "technical", [
                Q("When would you use EC2, Lambda or ECS/Fargate?",
                  "EC2 for full control over long-running servers. Lambda for event-driven, short-lived functions with "
                  "pay-per-invocation and automatic scaling (cold starts, 15 min limit). ECS/Fargate for running "
                  "containers without managing servers."),
                Q("What is S3 and what are its storage classes used for?",
                  "Object storage with very high durability for files, backups, static websites and data lakes. "
                  "Standard for frequent access, Standard-IA and One Zone-IA for infrequent access, Glacier tiers for "
                  "archives, and Intelligent-Tiering to move objects automatically."),
                Q("RDS versus DynamoDB?",
                  "RDS is managed relational databases (PostgreSQL, MySQL) with SQL, joins and transactions, scaled "
                  "vertically plus read replicas. DynamoDB is a serverless key-value/document store with single-digit "
                  "millisecond latency at any scale, but requires designing around access patterns."),
            ]),
            ("Architecture & Networking", "system_design", [
                Q("Explain a VPC, public and private subnets, and a NAT gateway.",
                  "A VPC is an isolated virtual network. Public subnets route to an internet gateway for internet-facing "
                  "resources like load balancers; private subnets hold app servers and databases with no direct inbound "
                  "access, reaching the internet outbound through a NAT gateway."),
                Design("Design a highly available web application on AWS.",
                       "Route 53 -> CloudFront -> Application Load Balancer across at least two Availability Zones -> "
                       "auto-scaling EC2 or ECS tasks in private subnets -> RDS Multi-AZ (plus read replicas) and "
                       "ElastiCache; static assets in S3; CloudWatch alarms; backups and infrastructure as code."),
                Q("How do SQS and SNS differ?",
                  "SQS is a queue: messages are pulled and processed by consumers, decoupling producers and buffering "
                  "load. SNS is pub/sub: a message is pushed to all subscribers (SQS, Lambda, email). Fan-out combines "
                  "SNS with several SQS queues."),
            ]),
            ("Security & Cost", "technical", [
                Q("How does IAM work and what is the principle of least privilege?",
                  "IAM users, groups and roles get permissions through JSON policies allowing or denying actions on "
                  "resources. Least privilege grants only the permissions needed. Prefer roles with temporary "
                  "credentials for services over long-lived access keys, and enable MFA."),
                Q("Security groups versus NACLs?",
                  "Security groups are stateful, instance-level firewalls with allow rules only. NACLs are stateless, "
                  "subnet-level rules with allow and deny, evaluated in order, requiring return traffic rules."),
                Q("How would you reduce an AWS bill?",
                  "Right-size instances, use auto scaling, Savings Plans/Reserved Instances for steady load and Spot for "
                  "fault-tolerant jobs, S3 lifecycle policies, delete idle resources and unattached volumes, reduce data "
                  "transfer with CloudFront, and monitor with Cost Explorer and budgets."),
            ]),
        ],
    },
    {
        "name": "Git", "category": "DevOps", "tone_style": "casual_friendly",
        "description": "Branching, merging vs rebasing, collaboration, and recovering from mistakes.",
        "rounds": [
            ("Everyday Git", "technical", [
                Q("What is the difference between git fetch and git pull?",
                  "fetch downloads new commits and branches from the remote without changing your working branch. pull "
                  "is fetch followed by merging (or rebasing) the upstream into the current branch."),
                Q("Explain the working directory, staging area and repository.",
                  "The working directory has your files, the staging area (index) holds changes selected with git add "
                  "for the next commit, and the repository stores committed snapshots. git status shows changes in "
                  "each stage."),
                Q("What does git stash do?",
                  "It saves uncommitted changes onto a stack and cleans the working directory so you can switch "
                  "context; git stash pop or apply restores them later."),
            ]),
            ("Branching & Merging", "technical", [
                Q("Merge versus rebase — pros, cons, and when to use each?",
                  "Merge combines branches with a merge commit and preserves history exactly; safe for shared branches. "
                  "Rebase replays your commits on top of another branch for a linear history, but rewrites commits, so "
                  "never rebase commits others have pulled."),
                Q("How do you resolve a merge conflict?",
                  "Open the conflicted files, edit the sections between the conflict markers to the correct combined "
                  "result, remove the markers, run tests, git add the files and complete the merge or rebase "
                  "(git commit / git rebase --continue)."),
                Q("Describe a branching strategy for a team.",
                  "Trunk-based development: short-lived feature branches merged into main via pull requests with "
                  "review and CI, feature flags for incomplete work, and release tags. Git Flow adds develop, release "
                  "and hotfix branches for scheduled releases."),
            ]),
            ("Fixing Mistakes", "technical", [
                Q("git reset versus git revert?",
                  "reset moves the branch pointer back (soft keeps changes staged, mixed keeps them unstaged, hard "
                  "discards them) and rewrites history, so use it on local commits. revert creates a new commit undoing "
                  "an earlier one, which is safe on shared branches."),
                Q("You committed a secret and pushed it. What do you do?",
                  "Revoke and rotate the secret immediately, since it must be considered leaked. Then remove it from "
                  "history (git filter-repo or BFG) and force-push in coordination with the team, and add secret "
                  "scanning and .gitignore rules to prevent repeats."),
                Q("How do you recover a commit you lost after a hard reset?",
                  "git reflog lists where HEAD has pointed; find the lost commit's hash and git reset --hard <hash> or "
                  "create a branch at it. Commits remain recoverable until garbage collected."),
            ]),
        ],
    },
    # -------------------------------------------------------------- Data & AI
    {
        "name": "Machine Learning", "category": "Data & AI", "tone_style": "formal_strict",
        "description": "Core ML concepts, model evaluation, and applied ML/LLM questions.",
        "rounds": [
            ("Fundamentals", "technical", [
                Q("Explain the bias-variance tradeoff.",
                  "Bias is error from overly simple assumptions (underfitting); variance is error from sensitivity to the "
                  "training data (overfitting). Increasing model complexity lowers bias and raises variance; aim for the "
                  "balance that minimises validation error."),
                Q("How do you detect and prevent overfitting?",
                  "Detect it when training error is low but validation error is high. Prevent with more data, "
                  "cross-validation, regularisation (L1/L2, dropout), simpler models, early stopping, feature selection "
                  "and data augmentation."),
                Q("Supervised versus unsupervised learning, with examples.",
                  "Supervised learning trains on labelled data to predict a target: classification (spam detection) and "
                  "regression (price prediction). Unsupervised learning finds structure in unlabelled data: clustering "
                  "(customer segments) and dimensionality reduction (PCA)."),
            ]),
            ("Model Evaluation", "technical", [
                Q("Explain precision, recall and F1. When does accuracy mislead?",
                  "Precision = TP / (TP + FP): of predicted positives, how many are right. Recall = TP / (TP + FN): of "
                  "actual positives, how many we found. F1 is their harmonic mean. Accuracy misleads on imbalanced data: "
                  "99% accuracy on 1% fraud by predicting no fraud at all."),
                Q("What is cross-validation and why use it?",
                  "Split data into k folds, train on k-1 and validate on the remaining fold, rotating and averaging the "
                  "scores. It gives a more reliable estimate of generalisation than one split and helps tune "
                  "hyperparameters without touching the test set."),
                Q("How do you handle an imbalanced dataset?",
                  "Use appropriate metrics (precision/recall, PR-AUC), resample (oversample the minority, SMOTE, "
                  "undersample the majority), use class weights, tune the decision threshold, and collect more minority "
                  "data."),
            ]),
            ("Applied ML & LLMs", "technical", [
                Q("Walk through how you would build a model to predict customer churn.",
                  "Define churn and the prediction window, gather and clean data, engineer features (usage, tenure, "
                  "support tickets), split by time to avoid leakage, start with a baseline (logistic regression) then "
                  "gradient boosting, evaluate with recall/PR-AUC, explain with feature importance/SHAP, deploy and "
                  "monitor for drift."),
                Q("What is data leakage? Give an example.",
                  "When information unavailable at prediction time leaks into training, inflating validation scores. "
                  "Examples: fitting a scaler on the full dataset before splitting, or using a feature recorded after "
                  "the outcome (refund issued) to predict the outcome."),
                Q("What is Retrieval-Augmented Generation (RAG) and why use it?",
                  "RAG retrieves relevant documents (via embeddings in a vector store) and passes them into the LLM "
                  "prompt so answers are grounded in up-to-date or private data, reducing hallucination without "
                  "fine-tuning. Quality depends on chunking, retrieval and evaluation."),
            ]),
        ],
    },
    {
        "name": "Data Analysis", "category": "Data & AI", "tone_style": "casual_friendly",
        "description": "Pandas, SQL for analytics, statistics, and turning data into insight.",
        "rounds": [
            ("Pandas & Data Wrangling", "technical", [
                Q("How do you handle missing values in a dataset?",
                  "First understand why they are missing. Then drop rows/columns if few or useless, impute with mean, "
                  "median, mode or forward-fill for time series, model-based imputation, or add a missing indicator. "
                  "Document the choice since it affects results."),
                Code("Using pandas, given a DataFrame `orders` with columns customer_id, amount and order_date, return "
                     "the top 5 customers by total amount in 2024.",
                     "Filter orders[orders.order_date.dt.year == 2024] (after pd.to_datetime), then "
                     ".groupby('customer_id')['amount'].sum().nlargest(5) or sort_values(ascending=False).head(5).",
                     "python",
                     "import pandas as pd\n\ndef top_customers(orders: pd.DataFrame) -> pd.Series:\n    pass\n"),
                Q("What is the difference between merge, join and concat in pandas?",
                  "merge does SQL-style joins on columns (inner, left, right, outer). join is a convenience for joining "
                  "on the index. concat stacks DataFrames along rows or columns without matching keys."),
            ]),
            ("Statistics", "technical", [
                Q("Mean versus median — when is the median better?",
                  "The mean is the average and is sensitive to outliers; the median is the middle value and robust to "
                  "them. Use the median for skewed data like salaries or house prices."),
                Q("Explain a p-value and statistical significance.",
                  "The p-value is the probability of seeing results at least as extreme as observed if the null "
                  "hypothesis were true. If it's below the chosen significance level (often 0.05) we reject the null. It "
                  "is not the probability the hypothesis is true and says nothing about effect size."),
                Q("How would you design and analyse an A/B test?",
                  "Define the hypothesis and primary metric, compute the sample size from the minimum detectable "
                  "effect, randomise users, run for full business cycles without peeking, check guardrail metrics, and "
                  "analyse with an appropriate test and confidence intervals."),
            ]),
            ("Business Case", "technical", [
                Q("Daily active users dropped 15% yesterday. How would you investigate?",
                  "Check data quality and tracking first (logging bugs, pipeline delays). Then segment by platform, app "
                  "version, region, acquisition channel and new vs returning users, look at recent releases, outages, "
                  "holidays or competitor events, and form and test hypotheses."),
                Q("How do you choose the right chart for your data?",
                  "Line charts for trends over time, bar charts for comparing categories, histograms for distributions, "
                  "scatter plots for relationships, and stacked or 100% bars for composition. Avoid pie charts with many "
                  "slices and keep axes honest."),
                Q("Which metrics would you track for a food delivery app?",
                  "Orders per day, active users, conversion from app open to order, average order value, delivery time "
                  "and on-time rate, cancellation rate, repeat rate/retention, customer acquisition cost, ratings, and "
                  "unit economics per order."),
            ]),
        ],
    },
    # ------------------------------------------------------------------- Career
    {
        "name": "HR & Behavioral", "category": "Career", "tone_style": "casual_friendly",
        "description": "Tell-me-about-yourself, STAR stories, and HR round questions.",
        "rounds": [
            ("Introduction & Motivation", "hr", [
                Behavioral("Tell me about yourself.",
                           "A 60-90 second answer: present (current role or degree and focus), past (one or two "
                           "relevant achievements with numbers), future (why this role and company fits). Keep it "
                           "relevant to the job, not a life story."),
                Behavioral("Why do you want to join our company?",
                           "Show research: the company's product, mission, growth or tech, connect it to your skills and "
                           "goals, and say what you'd contribute. Avoid generic answers about salary or brand name only."),
                Behavioral("Where do you see yourself in five years?",
                           "Show ambition aligned with the role: growing deep expertise, taking ownership of larger "
                           "projects or leading a team, while staying with the company. Be realistic and specific."),
            ]),
            ("Behavioral (STAR)", "behavioral", [
                Behavioral("Tell me about a time you faced a conflict with a teammate. How did you handle it?",
                           "Use STAR: describe the situation and your task, the actions you took (listening, private "
                           "conversation, focusing on the shared goal and data, finding a compromise or escalating "
                           "constructively), and the result plus what you learned. Show empathy, not blame."),
                Behavioral("Describe a time you failed or made a mistake.",
                           "Pick a real but recoverable mistake, own it without excuses, explain how you fixed it and "
                           "limited impact, and what you changed afterwards (process, checks, habits). Focus on learning."),
                Behavioral("Tell me about a project you're most proud of.",
                           "STAR with specifics: the problem and why it mattered, your personal contribution (I, not "
                           "we), technical decisions and trade-offs, measurable impact, and what you'd do differently."),
            ]),
            ("HR Round", "hr", [
                Behavioral("What are your strengths and weaknesses?",
                           "Give a strength relevant to the role with a concrete example. Give a genuine weakness that "
                           "isn't core to the job and explain the steps you're taking to improve it."),
                Behavioral("What are your salary expectations?",
                           "Research the market range for the role, city and experience. Give a range anchored on that "
                           "research, mention flexibility for the overall package, or ask for the budgeted range first."),
                Behavioral("Do you have any questions for us?",
                           "Always ask two or three thoughtful questions: what success looks like in the first 90 days, "
                           "team structure and how work is planned, growth and learning opportunities, and current "
                           "challenges the team faces."),
            ]),
        ],
    },
]


def sync_skill_bank(Company, Role, Round, InterviewQuestion) -> dict:
    """Create whatever part of SKILLS is missing. Takes the model classes so a
    migration can pass its historical models. Returns created counts."""
    created = {"skills": 0, "rounds": 0, "questions": 0}
    for skill_data in SKILLS:
        skill, made = Company.objects.get_or_create(
            name=skill_data["name"],
            kind="skill",
            organization=None,
            defaults={
                "tone_style": skill_data["tone_style"],
                "description": skill_data["description"],
                "category": skill_data["category"],
            },
        )
        created["skills"] += made
        if not made and not skill.category:
            skill.category = skill_data["category"]
            skill.save(update_fields=["category"])
        role, _ = Role.objects.get_or_create(company=skill, title=ROLE_TITLE)
        for order, (title, round_type, questions) in enumerate(skill_data["rounds"]):
            round_obj, made = Round.objects.get_or_create(
                role=role, title=title, defaults={"order": order, "round_type": round_type},
            )
            created["rounds"] += made
            existing = set(InterviewQuestion.objects.filter(round=round_obj).values_list("question_text", flat=True))
            new = [InterviewQuestion(round=round_obj, status="approved", generated_by_ai=False, **q)
                   for q in questions if q["question_text"] not in existing]
            InterviewQuestion.objects.bulk_create(new)
            created["questions"] += len(new)
    return created
