import React, { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { supabase } from "./utils/supabase";

type Todo = {
  id: number;
  title: string;
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    async function getTodos() {
      try {
        const { data, error } = await supabase.from("todos").select();

        if (error) {
          console.error("Error fetching todos:", error.message);
          return;
        }

        if (data && data.length > 0) {
          setTodos(data as Todo[]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching todos:", message);
      }
    }

    getTodos();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Todo List</Text>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <Text key={item.id}>{item.title}</Text>}
      />
    </View>
  );
}
