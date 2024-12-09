const express = require("express")
const app = express()
const path = require("path")
const cors = require("cors")
const sqlite3 = require("sqlite3")
const {open} = require("sqlite")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
app.use(express.json())
app.use(cors())


const dbPath = path.join(__dirname,'userDatabase.db')
let db = null;
const port = 3009;
const initializeDBAndServer = async() => {
    try {
        db = await open({
            filename:dbPath,
            driver:sqlite3.Database
        })
        app.listen(port,()=>{
        console.log(`Server Running at:http://localhost:${port}/`)
    })
    } catch (error) {
        console.log("DB Error at:",error)
        process.exit(1);
    }
}

initializeDBAndServer()

//ADD user

app.post("/api/auth/register", async (request, response) => {
  const { username, password} = request.body;
  const getUserQuery = `SELECT * FROM Users WHERE username='${username}';`;
  const userResponse = await db.get(getUserQuery);
  if (userResponse !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    
    const checkPasswordLength = password.length > 6;
    const encryptedPassword = await bcrypt.hash(password, 10);
    // console.log(checkPasswordLength);
    if (checkPasswordLength === true) {
      const createNewUser = `
      INSERT 
      INTO 
      Users
      (username,password) 
      VALUES 
      (
        '${username}',
        '${encryptedPassword}');`;
      await db.run(createNewUser);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  }
});

//Login User

app.post("/api/auth/login", async (request, response) => {
  const { username, password } = request.body;
  const getUserInfo = `SELECT * FROM Users WHERE username='${username}';`;
  const userResponse = await db.get(getUserInfo);
  if (userResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkIsPasswordMatched = await bcrypt.compare(
      password,
      userResponse.password
    );
    if (checkIsPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken =jwt.sign(payload, "My_Secret_Key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
}); 

//Middleware - Authentication 

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Secret_Key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//User Profile 

app.get("/profile", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM Users WHERE username='${username}'`;
  const userDetails =await db.get(selectUserQuery);
  response.send(userDetails);
});

//ADD Task 

app.post("/api/tasks",async(request,response) => {
    const {user_id,title,description,status} = request.body;
    // const taskDetails = request.body;
    const upperStatus = status.toUpperCase()
    // console.log(taskDetails);
    // console.log(upperStatus)

    const checkTaskName = `SELECT * FROM Tasks WHERE title='${title}';`;
    if(checkTaskName === undefined){
        response.status(400);
        response.send("Task already exist")
    }
    const addTaskQuery = `INSERT INTO Tasks(user_id,title,description,status) VALUES(${user_id},'${title}','${description}','${upperStatus}');`;
    const addTaskQueryResponse = await db.run(addTaskQuery);
    const taskId = addTaskQueryResponse.lastID;
    response.send(`Task added Successfully with ID: ${taskId}`);
})

//Get all Tasks 

app.get("/api/tasks",async(request,response) => {
    const {status,search_q=""} = request.query;
    console.log(status)
    const getAllTasksRequest = `SELECT * FROM Tasks;`;
    const getAllTasksResponse = await db.all(getAllTasksRequest)
    response.send(getAllTasksResponse);
})

//Get Specific Task 

app.get("/api/tasks/:id",async(request,response) => {
    const {id} = request.params;
    const getSingleTasksRequest = `SELECT * FROM Tasks WHERE id=${id};`;
    const getSingleTasksResponse = await db.get(getSingleTasksRequest)
    // console.log(getSingleTasksResponse)
    if(getSingleTasksResponse === undefined){
        response.status(400);
        response.send("Task not exists,Please try with valid id")
    }else{
        response.send(getSingleTasksResponse)
    }
})

//Update Task 

app.put("/api/tasks/:id",async(request,response) => {
    const {id} = request.params;
    const {user_id,title,description,status} = request.body;
    // const taskDetails = request.body;
    const upperStatus = status.toUpperCase()
    // console.log(taskDetails);
    // console.log(upperStatus)
    const updateTaskQuery = `
        UPDATE Tasks 
        SET 
            user_id=${user_id},
            title='${title}',
            description='${description}',
            status='${upperStatus}' 
        WHERE id=${id} `;
    await db.run(updateTaskQuery)
    response.send("Task Updated Successfully!!!")
})

//DELETE specific task 

app.delete("/api/tasks/:id",async(request,response) => {
    const {id} = request.params;
    const checkTaskInDB = `SELECT * FROM Tasks WHERE id=${id}`;
    const checkTaskInDbResponse = await db.get(checkTaskInDB);
    if(checkTaskInDbResponse === undefined){
        response.status(400)
        response.send("Invalid task id,try again with valid id")
    }else{
        const deleteTaskQuery = `DELETE FROM Tasks WHERE id=${id}`;
        await db.run(deleteTaskQuery);
        response.send("Task deleted Successfully");
    }
})