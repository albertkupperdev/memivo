import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEMO_TITLE = "JavaScript Fundamentals";

const DEMO_CARDS: { front: string; back: string }[] = [
  { front: "What does `===` check that `==` doesn't?", back: "`===` also checks type, not just value — no implicit coercion." },
  { front: "What is a closure?", back: "A function that remembers the variables from the scope it was created in, even after that scope has exited." },
  { front: "What's the difference between `let` and `var`?", back: "`let` is block-scoped; `var` is function-scoped and gets hoisted with `undefined`." },
  { front: "What does `Array.prototype.map()` return?", back: "A new array with the results of calling a function on every element — the original is unchanged." },
  { front: "What is the event loop?", back: "The mechanism that lets JS run non-blocking callbacks by processing the call stack, then microtasks, then macrotasks." },
  { front: "What does `this` refer to in an arrow function?", back: "Arrow functions don't have their own `this` — they inherit it from the enclosing lexical scope." },
  { front: "What is a Promise?", back: "An object representing the eventual result (or failure) of an asynchronous operation, with states: pending, fulfilled, rejected." },
  { front: "What does `JSON.stringify()` do to `undefined` values in an object?", back: "It omits keys whose value is `undefined`." },
  { front: "What is destructuring?", back: "A syntax for unpacking values from arrays or properties from objects into distinct variables." },
  { front: "What does the spread operator (`...`) do on an array?", back: "It expands the array's elements in place — used for copying, merging, or passing as arguments." },
  { front: "What is `NaN === NaN`?", back: "`false` — NaN is never equal to itself. Use `Number.isNaN()` to check for it." },
  { front: "What's the difference between `null` and `undefined`?", back: "`undefined` means a variable was declared but never assigned; `null` is an explicit 'no value' assignment." },
  { front: "What does `async`/`await` do?", back: "Lets you write asynchronous, Promise-based code as if it were synchronous, pausing execution until the Promise resolves." },
  { front: "What is hoisting?", back: "JS moves variable and function declarations to the top of their scope before execution — `var` and function declarations are hoisted." },
  { front: "What does `Array.prototype.reduce()` do?", back: "Runs a reducer function over each array element, accumulating a single output value." },
  { front: "What is the difference between `null` and `0` in a boolean context?", back: "Both are falsy, but `null` represents 'no value' while `0` is a valid number — `null == 0` is `false`." },
];

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) {
    return NextResponse.json({ seeded: false });
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({ user_id: user.id, title: DEMO_TITLE, source_type: "manual" })
    .select()
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Failed to seed demo deck" }, { status: 500 });
  }

  const { data: chunks, error: chunkError } = await supabase
    .from("chunks")
    .insert(
      DEMO_CARDS.map((card, index) => ({
        document_id: document.id,
        content: `${card.front}\n${card.back}`,
        chunk_index: index,
      }))
    )
    .select("id")
    .order("chunk_index", { ascending: true });

  if (chunkError || !chunks) {
    return NextResponse.json({ error: "Failed to seed demo deck" }, { status: 500 });
  }

  const { error: cardError } = await supabase.from("cards").insert(
    DEMO_CARDS.map((card, index) => ({
      document_id: document.id,
      chunk_id: chunks[index].id,
      front: card.front,
      back: card.back,
    }))
  );

  if (cardError) {
    return NextResponse.json({ error: "Failed to seed demo deck" }, { status: 500 });
  }

  return NextResponse.json({ seeded: true });
}
