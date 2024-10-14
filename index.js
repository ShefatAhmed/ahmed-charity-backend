const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://ahmed-charity.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("assignment");
    const collection = db.collection("users");
    const donationCollection = db.collection("donation");
    const donatedCollection = db.collection("donated");
    const coummunityCollection = db.collection("coummunity");
    const testimonialCollection = db.collection("testimonial");
    const volunteerCollection = db.collection("volunteer");

    // User Registration
    app.post("/api/auth/register", async (req, res) => {
      const { name, email, password } = req.body;

      // Check if email already exists
      const existingUser = await collection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      const amount = 0;

      // Insert user into the database
      await collection.insertOne({
        name,
        email,
        amount,
        password: hashedPassword,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await collection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { email: user.email, name: user.name, amount: user.amount },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.EXPIRES_IN,
        }
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
      });
    });
    app.put("/api/auth/donors-user/:email", async (req, res) => {
      const userEmail = req.params.email;
      const { name, email, amount } = req.body;

      try {
        const existingUser = await collection.findOne({ email: userEmail });
        if (!existingUser) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }
        const filter = { email: userEmail };
        const updateData = {
          $set: {
            name: name || existingUser.name,
            email: email || existingUser.email,
            amount: amount || existingUser.amount,
          },
        };

        const result = await collection.updateOne(filter, updateData);

        res.json({
          name: name || existingUser.name,
          email: email || existingUser.email,
          amount: amount || existingUser.amount,
        });
      } catch (error) {
        console.error("Error updating user information:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });

    //get all users
    app.get("/api/v1/users", async (req, res) => {
      try {
        // Fetch data from the collection and sort it by the "amount" field in descending order
        const result = await collection.find().sort({ amount: -1 }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching and sorting data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //create a donation
    app.post("/api/v1/create-donation", async (req, res) => {
      const { image, category, title, amount, description } = req.body;
      const result = await donationCollection.insertOne({
        image,
        category,
        title,
        amount,
        description,
      });
      res.send(result);
    });

    //get all donation
    app.get("/api/v1/donation", async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    });

    //delete a donation data
    app.delete("/api/v1/donation/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });
    app.put("/api/v1/donation/:id", async (req, res) => {
      const id = req.params.id;
      const donation = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateData = {
        $set: {
          image: donation.image,
          category: donation.category,
          title: donation.title,
          amount: donation.amount,
          description: donation.description,
        },
      };
      const result = await donationCollection.updateOne(filter, updateData);
      res.send(result);
    });

    app.post("/api/v1/donation/:id/review", async (req, res) => {
      const donationId = req.params.id;
      const { reviewText, reviewerName } = req.body;

      const review = {
        text: reviewText,
        name: reviewerName,
        date: new Date(),
      };

      try {
        const result = await donationCollection.updateOne(
          { _id: new ObjectId(donationId) },
          { $push: { reviews: review } }
        );
        res.json({ success: true, result });
      } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    });

    app.get("/api/v1/donation/:id/reviews", async (req, res) => {
      const donationId = req.params.id;

      try {
        const donation = await donationCollection.findOne(
          { _id: new ObjectId(donationId) },
          { projection: { reviews: 1 } }
        );

        if (!donation) {
          return res.status(404).json({ message: "Donation not found" });
        }

        res.json(donation.reviews || []);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    });

    //donated post
    app.get("/api/v1/donated", async (req, res) => {
      const result = await donatedCollection.find().toArray();
      res.send(result);
    });

    //coummunity post
    app.post("/api/v1/comment", async (req, res) => {
      const { name, heading, comment, date } = req.body;
      const data = await coummunityCollection.insertOne({
        name,
        heading,
        comment,
        date,
      });
      res.send(data);
    });
    app.get("/api/v1/comments", async (req, res) => {
      const result = await coummunityCollection
        .find()
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    //testimonial
    app.post("/api/v1/testimonial", async (req, res) => {
      const { name, image, amount, description } = req.body;
      const data = await testimonialCollection.insertOne({
        name,
        image,
        amount,
        description,
      });
      res.send(data);
    });
    app.get("/api/v1/testimonials", async (req, res) => {
      const result = await testimonialCollection.find().toArray();
      res.send(result);
    });

    // volunteer
    app.post("/api/v1/volunteer", async (req, res) => {
      const { name, email, phoneNumber, location } = req.body;
      const data = await volunteerCollection.insertOne({
        name,
        email,
        phoneNumber,
        location,
      });
      res.send(data);
    });
    app.get("/api/v1/volunteers", async (req, res) => {
      const result = await volunteerCollection.find().toArray();
      res.send(result);
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});
