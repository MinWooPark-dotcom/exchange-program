const readline = require("readline");
/** readline.Interface클래스의 인스턴스는 readline.createInterface()메서드를 사용하여 생성 **/
// input은 ReadableStream ouput은 WritableStream과 연결됨.
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


const a = rl.question("1.메뉴로 돌아가기 2.로그아웃 3.프로그램 종료", async function (answer) {
    console.log('answer', answer)
    rl.close()
});

console.log('a' ,a)
