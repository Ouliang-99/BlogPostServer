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

export default router;
