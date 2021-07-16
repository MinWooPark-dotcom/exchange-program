/** static method vs instance method : 가장 큰 차이점은 객체 생성 여부
 * Q. 인스턴스에서 static method를 사용할 수 있나?
 * A. 결론은 사용 못한다.
 * 정적 메소드는 클래스의 인스턴스 없이도 호출이 가능하지만, 클래스가 인스턴스화되면 호출이 불가능하다.
 * 인스턴스화 되면 정적 메서드를 호출할 수 없지만 인스턴스 메서드 안에 클래스명.정적메서드 or this.constructor.정적메서드를 넣어놓으면 사용 가능
 *
 * 그럼 왜???
 * 정적 메서드는 클래스가 메모리에 올라갈 때 자동으로 생성되기 때문에 인스턴스를 생성하지 않아도 사용할 수 있음
 * 인스턴스 메서드는 구현 방식에 따라 다르지만, 클래스가 객체로 인스턴스화 되었을 때 해당 인스턴스에 내장되어 있거나 혹은 프로토타입 상위로부터 상속 받아 사용하게 된다.
 * **/
class TestClass {
    // 1. 정적 메서드
    static staticMethod1() {
        return '정적 메서드1';
    }
    // 2. 다른 static method 내부에서 기존의 static method에 접근하고자 할 때에는 this keyword를 사용할 수 있다.
    static staticMethod2() {
        /** Q. 왜 this가 클래스 자체를 가르키는가?
         * A. this의 값은 함수를 호출한 방법에 의해 결정, TestClass.staticMethod2를 보면 호출자가 TestClass니까 this가 클래스 자체를 가르킴 **/
        // console.log('this', this)  // 클래스 자체를 가르킴 calss testClass {...}
        return this.staticMethod1() + '랑 같이 쓰는 정적 메서드 2';
    }
    // 3. 인스턴스 메서드
    instanceMethod1() {
        return 'instance method'
    }
    // 4. 인스턴스 메서드에서 정적 메서드 사용, this로 사용 불가 class or this.constructor를 사용
    /** Q. 왜 인스턴스 메서드에서는 this로 정적 메서드를 사용 못하는가?
     * A. 인스턴스 메서드 호출 시 this는 인스턴스를 가르키기 떄문에 class이름을 사용하거나 this.constructor**/
    instanceMethod2() {
        return TestClass.staticMethod1()
    }
    // 5. 인스턴스 메서드에서 정적 메서드 사용, this로 사용 불가 class or this.constructor를 사용
    instanceMethod3() {
        /** Q. 왜 this.constructor가 클래스 자체를 가르키나?
         * A. constructor는 생성자 함수, 해당 인스턴스를 만든 생성자 함수는 TestClass이기에 클래스 자체를 가르킴
         * 참고로 typeof TestClass는 function **/
        // console.log('typeof TestClass', typeof TestClass) // function
        // console.log('this.constructor', this.constructor)  // 클래스 자체를 가르킴 calss testClass {...}
        return this.constructor.staticMethod1();
    }
}

console.log('TestClass.staticMethod1()', TestClass.staticMethod1()) // 정적 메서드1
console.log('TestClass.staticMethod2()', TestClass.staticMethod2()) // 정적 메서드1랑 같이 쓰는 정적 메서드2
// 인스턴스화되면 정적 메소드는 사용이 불가능하다.
const instance = new TestClass();
console.log('instance.instanceMethod1()', instance.instanceMethod1()); // instance method
console.log('instance.instanceMethod2()', instance.instanceMethod2()); // 정적 메서드1
console.log('instance.instanceMethod3()', instance.instanceMethod3()); // 정적 메서드1
// console.log(instance.staticMethod1()) // Static member is not accessible
// => instance.staticMethod1 is not a function