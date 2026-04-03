function App() {
  return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-green-400 mb-4">
            Minesweeper 💣
          </h1>
          <p className="text-xl text-gray-300">
            Tailwind v4 успішно підключено!
          </p>
          <button className="mt-6 rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 cursor-pointer">
            Почати гру
          </button>
        </div>
      </div>
  )
}

export default App