import express from "express";
import supabase from "../lib/db.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.get("/posts", async (req, res) => {
  const { category = "", keyword = "", page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;

    let query = supabase
      .from("posts")
      .select(
        `
        id, 
        image, 
        title, 
        description, 
        date, 
        content, 
        status_id, 
        likes_count, 
        category_id
      `
      )
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("name", category)
        .single();

      if (categoryError || !categoryData) {
        return res
          .status(400)
          .json({ success: false, error: "Category not found" });
      }

      query = query.eq("category_id", categoryData.id);
    }

    if (keyword) {
      query = query.ilike("title", `%${keyword}%`);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) throw postsError;

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name");

    if (categoriesError) throw categoriesError;

    const result = posts.map((post) => {
      const category = categories.find((c) => c.id === post.category_id);
      return { ...post, category_name: category ? category.name : null };
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/posts", async (req, res) => {
  const { title, content, category } = req.body;

  try {
    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("name", category)
      .single();

    if (categoryError || !categoryData) {
      throw new Error("Category not found");
    }

    const { data, error } = await supabase.from("posts").insert([
      {
        title,
        content,
        category_id: categoryData.id,
        created_at: new Date(),
      },
    ]);

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/posts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // ดึงข้อมูล post พร้อมกับข้อมูล category แบบ join
    const { data: post, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        categories(name)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post("/isLiked", async (req, res) => {
  const { user_id, post_id } = req.body;

  try {
    if (!user_id || !post_id) {
      return res
        .status(400)
        .json({ success: false, error: "Missing user_id or post_id" });
    }

    const { data: like, error } = await supabase
      .from("likes")
      .select("*")
      .eq("user_id", user_id)
      .eq("post_id", post_id)
      .limit(1);

    if (error) throw error;

    if (like && like.length > 0) {
      return res.json({
        success: true,
        isLiked: true,
      });
    } else {
      return res.json({
        success: true,
        isLiked: false,
      });
    }
  } catch (err) {
    console.error("Error fetching like data:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/likes", async (req, res) => {
  const { user_id, post_id } = req.body;

  try {
    const { data: existingLike, error: checkError } = await supabase
      .from("likes")
      .select("id")
      .eq("user_id", user_id)
      .eq("post_id", post_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") throw checkError;
    if (existingLike) {
      return res
        .status(400)
        .json({ success: false, error: "Already liked this post" });
    }

    const { data, error } = await supabase.from("likes").insert([
      {
        post_id,
        user_id,
        liked_at: new Date(),
      },
    ]);

    if (error) throw error;

    const { data: addLike, error: addLikeError } = await supabase.rpc(
      "increment_like",
      {
        post_id: 7,
      }
    );
    if (error) console.error(error);

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/unlike", async (req, res) => {
  const { user_id, post_id } = req.body;

  try {
    const { data: existingLike, error: checkError } = await supabase
      .from("likes")
      .select("id")
      .eq("user_id", user_id)
      .eq("post_id", post_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") throw checkError;
    if (!existingLike) {
      return res
        .status(400)
        .json({ success: false, error: "Not liked this post" });
    }

    const { data: removedLike, error: deleteError } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", user_id)
      .eq("post_id", post_id);

    if (deleteError) throw deleteError;

    const { data: updatePost, error: updateError } = await supabase.rpc(
      "decrement_like",
      { post_id: post_id }
    );

    if (updateError) {
      return res
        .status(500)
        .json({ success: false, error: updateError.message });
    }

    res.status(200).json({
      success: true,
      message: "Post unliked successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/comments/:post_id", async (req, res) => {
  const { post_id } = req.params;
  try {
    const { data: comments, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        users:users(name, profile_pic)
      `
      )
      .eq("post_id", post_id);

    if (error) throw error;

    if (comments.length === 0) {
      res.json({
        success: true,
        comments: null,
      });
    } else {
      res.json({
        success: true,
        comments: comments,
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post("/comments/:post_id", async (req, res) => {
  const { user_id, comment_text } = req.body;
  const { post_id } = req.params;
  
  try {
    const { data, error } = await supabase.from("comments").insert([
      {
        post_id,
        user_id,
        comment_text,
        created_at: new Date(),
      },
    ]);

    if (error) throw error;

    res.status(201).json({ success: true, message: "Comment successfully added!" });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


router.post("/signup", async (req, res) => {
  const { name, username, email, password } = req.body;

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    const { data, error } = await supabase.from("users").insert([
      {
        id: authData.user.id,
        name,
        username,
        email,
        created_at: new Date(),
      },
    ]);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(201).json({ success: true, data: authData.user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      return res.status(400).json({ error: loginError.message });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    res.status(200).json({ user: userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/update_user", async (req, res) => {
  const { userId, updateData } = req.body;

  try {
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } catch (err) {
    console.error("Error updating user:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
