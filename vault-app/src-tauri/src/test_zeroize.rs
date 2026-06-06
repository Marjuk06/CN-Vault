use zeroize::Zeroize;

fn main() {
    let mut s = String::from("secret");
    s.zeroize();
    println!("Zeroized string bytes: {:?}", s.as_bytes());
}
